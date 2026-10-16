import { useState } from "react";
import { findFen } from "../../utils/findFen";
import { useDispatch } from 'react-redux';
import { gameResetFen, gameResetMoves, gameResetStart } from "../../slices/gameSlice";
import { reunion } from "../../utils/reunionEngine"; // Import reunion engine
import type { Color } from "chessops/types";
import type { CanvasRef, CornersRef, ModelRefs, SetStringArray, VideoRef } from "../../types";

const FenButton = ({ piecesModelRef, videoRef, canvasRef, setText, cornersRef }:
  Pick<ModelRefs, "piecesModelRef"> & {
    videoRef: VideoRef,
    canvasRef: CanvasRef,
    setText: SetStringArray,
    cornersRef: CornersRef
  }) => {
  const options = ["Normal", "Infer (White to move)", "Infer (Black to move)"];

  const dispatch = useDispatch();
  const [option, setOption] = useState<string>(options[0]);

  const handleClick = async (option: string) => {
    // Unlock audio layer on any button click (valid user gesture)
        try {
      // 1. Await the initialization fully before proceeding
      await reunion.init();
    } catch (audioError) {
      console.error("Failed to initialize audio engine:", audioError);
    }

    if (option === "Normal") {
      dispatch(gameResetStart());
      dispatch(gameResetMoves());
      dispatch(gameResetFen());
    } else {
      const color: Color = option.includes("White to move") ? "white" : "black";
      void findFen({ piecesModelRef, videoRef, cornersRef, canvasRef, dispatch, setText, color })
        .catch((error: unknown) => {
          console.error("Unable to infer the starting position", error);
          setText(["Unable to infer the starting position"]);
        });
    }
    setOption(option);
  }

  return (
    <div className="dropdown">
      <button type="button" className="btn btn-dark btn-sm btn-outline-light dropdown-toggle w-100" id="dropdownMenuButton1" data-bs-toggle="dropdown" aria-expanded="false">
        Start: {option}
      </button>
      <ul className="dropdown-menu" aria-labelledby="dropdownMenuButton1">
        {options.map((opt) =>
          <li key={opt}>
            <button type="button" onClick={() => void handleClick(opt)} className="dropdown-item">{opt}</button>
          </li>
        )}
      </ul>
    </div>
  );
};

export default FenButton;
