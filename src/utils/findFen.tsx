import * as tf from "@tensorflow/tfjs-core";
import { getInvTransform, transformBoundary, transformCenters } from "./warp";
import { invalidVideo } from "./detect";
import { detect, getKeypoints, getSquares, getUpdate } from "./findPieces";
import { parseFen, makeFen } from "chessops/fen";
import { Chess } from "chessops/chess";
import type { Color, Role } from "chessops/types";
import { opposite } from "chessops/util";
import { PIECE_SYMBOLS, SQUARE_NAMES } from "./constants";
import { gameResetMoves, gameSetFen, gameSetStart } from "../slices/gameSlice";
import { renderState } from "./render/renderState";
import type { CanvasRef, CornersRef, ModelRefs, SetStringArray, VideoRef } from "../types";
import type { Dispatch, UnknownAction } from "@reduxjs/toolkit";

// === 1. IMPORT THE REUNION ENGINE HERE ===
import { reunion } from "./reunionEngine"; 

(window as any).reunion = reunion;

interface FindFenInput {
  piecesModelRef: ModelRefs["piecesModelRef"],
  videoRef: VideoRef,
  cornersRef: CornersRef,
  canvasRef: CanvasRef,
  dispatch: Dispatch<UnknownAction>,
  setText: SetStringArray,
  color: Color
}

const getFenAndError = (pos: Chess, color: Color) => {
  const fen = makeFen(pos.toSetup());
  const otherColor: Color = opposite(color);

  let error = null;

  // Side to move has opponent in check
  const otherKing = pos.board.kingOf(otherColor);
  if (otherKing !== undefined) {
    if (pos.kingAttackers(otherKing, color, pos.board.occupied).nonEmpty()) {
      error = "Side to move has opponent in check";
      return { fen, error };
    }
  }

  return { fen, error };
}

const setFenFromState = (
  state: number[][],
  color: Color,
  dispatch: Dispatch<UnknownAction>,
  setText: SetStringArray
) => {
  const assignment = Array(64).fill(-1);

  // In the first pass, assign the black king
  let bestBlackKingScore = -1;
  let bestBlackKingIdx = -1;
  for (let i = 0; i < 64; i++) {
    const blackKingScore = state[i][1];
    if (blackKingScore > bestBlackKingScore) {
      bestBlackKingScore = blackKingScore;
      bestBlackKingIdx = i;
    }
  }
  assignment[bestBlackKingIdx] = 1;

  // In the second pass, assign the white king
  let bestWhiteKingScore = -1;
  let bestWhiteKingIdx = -1;
  for (let i = 0; i < 64; i++) {
    if (i === bestBlackKingIdx) {
      continue;
    }
    const whiteKingScore = state[i][7];
    if (whiteKingScore > bestWhiteKingScore) {
      bestWhiteKingScore = whiteKingScore;
      bestWhiteKingIdx = i;
    }
  }
  assignment[bestWhiteKingIdx] = 7;

  // In the third pass, assign the remaining unplaced pieces using a chance operation (John Cage style)
  const allPieces = Array.from({ length: 12 }, (_, i) => i);
  const assignedSet = new Set(assignment.filter(val => val !== -1));
  const remainingPieceIdxs = allPieces
    .filter(idx => !assignedSet.has(idx))
    .sort(() => Math.random() - 0.5);

  let piecePointer = 0;
  for (let i = 0; i < 64; i++) {
    if (assignment[i] !== -1) {
      continue;
    }
    if (piecePointer < remainingPieceIdxs.length) {
      assignment[i] = remainingPieceIdxs[piecePointer++];
    } else {
      assignment[i] = 0; // fallback default
    }
  }

  // === 2. STREAM THE RAW DETECTED LAYOUT MATRIX INTO REUNION ENGINE ===
  const binaryOccupancyArray = assignment.map(value => value !== -1 ? 1 : 0);
  reunion.updateBoardState(binaryOccupancyArray);

  // chessops rejects an entirely empty position, so start from a legal board
  const turn = color === "white" ? "w" : "b";
  const setup = parseFen(`4k3/8/8/8/8/8/8/4K3 ${turn} - - 0 1`).unwrap();
  const board = Chess.fromSetup(setup).unwrap();
  board.board.clear();
  for (let i = 0; i < 64; i++) {
    if (assignment[i] === -1) {
      continue;
    }
    const role: Role = PIECE_SYMBOLS[assignment[i] % 6];
    const pieceColor: Color = (assignment[i] > 5) ? 'white' : 'black';
    board.board.set(i, { role, color: pieceColor });
  }

  const { fen, error } = getFenAndError(board, color);
  if (error === null) {
    dispatch(gameSetStart(fen));
    dispatch(gameSetFen(fen));
    dispatch(gameResetMoves());
    setText(["Set starting FEN"]);
  } else {
    setText(["Invalid FEN:", error]);
  }
}

export const _findFen = async ({ piecesModelRef, videoRef,
  cornersRef, canvasRef, dispatch, setText, color }: FindFenInput) => {
  if (invalidVideo(videoRef)) {
    return;
  }
  const canvas = canvasRef.current;
  if (canvas === null) {
    return;
  }
  const keypoints: number[][] = getKeypoints(cornersRef, canvasRef);

  const invTransform = getInvTransform(keypoints);
  const [centers, centers3D] = transformCenters(invTransform);
  const [boundary, boundary3D] = transformBoundary(invTransform);
  const { boxes, scores } = await detect(piecesModelRef, videoRef, keypoints);
  try {
    const squares: number[] = getSquares(boxes, centers3D, boundary3D);
    const state = getUpdate(scores, squares);
    setFenFromState(state, color, dispatch, setText);

    renderState(canvas, centers, boundary, state);
  } finally {
    tf.dispose([boxes, scores, centers3D, boundary3D]);
  }
}

export const findFen = async ({ piecesModelRef, videoRef, cornersRef, canvasRef, dispatch, setText, color }:
  FindFenInput) => {
  
  // === 3. UNLOCK CHROME AUDIO LAYER DURING FIRST RESOLUTION STEP ===
  await reunion.init();

  const startTensors = tf.memory().numTensors;

  await _findFen({ piecesModelRef, videoRef, cornersRef, canvasRef, dispatch, setText, color });

  const endTensors = tf.memory().numTensors;
  if (startTensors < endTensors) {
    console.error(`Memory Leak! (${endTensors} > ${startTensors})`)
  }

  return () => {
    tf.disposeVariables();
  };
}
