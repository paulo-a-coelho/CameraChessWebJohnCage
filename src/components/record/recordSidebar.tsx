import * as Tone from 'tone';
import { CornersButton, Sidebar, RecordButton, StopButton, FenButton, DeviceButton } from "../common";
import { reunion } from "../../utils/reunionEngine";
import type {
  CanvasRef, CornersRef, ModelRefs, SetBoolean, SetStringArray, SidebarRef, VideoRef
} from "../../types";

const RecordSidebar = ({ piecesModelRef, xcornersModelRef, videoRef, canvasRef, sidebarRef, 
  playing, setPlaying, text, setText, cornersRef }: {
  piecesModelRef: ModelRefs["piecesModelRef"],
  xcornersModelRef: ModelRefs["xcornersModelRef"],
  videoRef: VideoRef,
  canvasRef: CanvasRef,
  sidebarRef: SidebarRef,
  playing: boolean, setPlaying: SetBoolean, 
  text: string[], setText: SetStringArray,
  cornersRef: CornersRef
}) => {
  const inputStyle = {
    display: playing ? "none": "inline-block"
  }
    return (
    <Sidebar sidebarRef={sidebarRef} playing={playing} text={text} setText={setText} >
      <li className="my-1" style={inputStyle}>
        <DeviceButton videoRef={videoRef} />
      </li>
      <li className="my-1" style={inputStyle}>
        <CornersButton piecesModelRef={piecesModelRef} xcornersModelRef={xcornersModelRef} videoRef={videoRef} canvasRef={canvasRef} 
        setText={setText} />
      </li>
      <li className="my-1" style={inputStyle}>
        <FenButton piecesModelRef={piecesModelRef} videoRef={videoRef} 
        canvasRef={canvasRef} setText={setText} cornersRef={cornersRef} />
      </li>
      
      {/* ❌ REMOVED THE OUTER <li className="my-1"> WRAPPER FROM HERE */}
      <div className="btn-group w-100" role="group" aria-label="Move detection controls">
        <RecordButton 
          playing={playing} 
          setPlaying={async (val) => {
            if (val === true) {
              try {
                // 1. Initialize Tone.js via user click gesture
                await reunion.init(); 
                console.log("Audio initialized from record click!");
                
                // 2. 👉 DIRECT INLINE TEST (Bypasses the engine caching error)
                const testSynth = new Tone.Synth().toDestination();
                testSynth.triggerAttackRelease("C4", "4n");
                console.log("🔊 Inline diagnostic note played successfully!");

              } catch (e) {
                console.error("Failed to unlock audio engine", e);
              }
            }
            setPlaying(val);
          }} 
        />

        <StopButton setPlaying={setPlaying} setText={setText} />
      </div>
    </Sidebar>
  );

};

export default RecordSidebar;
