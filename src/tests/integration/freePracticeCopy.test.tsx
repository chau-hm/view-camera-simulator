import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MovementControls } from "../../components/controls/MovementControls";
import { FeedbackPanel } from "../../components/simulator/FeedbackPanel";
import { TaskPanel } from "../../components/simulator/TaskPanel";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { changeLocale, i18n } from "../../i18n";
import { LOCALE_STORAGE_KEY } from "../../i18n/localePreference";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { evaluateInteriorCornerRiseComposition } from "../../scenes/interiorCornerRiseComposition";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const resetLocale = async () => {
  cleanup();
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage("en");
  document.documentElement.lang = "en";
};

beforeEach(resetLocale);
afterEach(resetLocale);

const interiorCornerEvaluationAtRise = (frontRiseMm: number) =>
  evaluateInteriorCornerRiseComposition(
    deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...interiorCornerScene.cameraPreset,
        activeSceneId: interiorCornerScene.id,
        activeTaskId: null,
        mode: "free",
        frontRiseMm,
      },
      interiorCornerScene,
    ),
  );

const firstPassingInteriorCornerRise = (): number => {
  for (
    let riseMm = CAMERA_CONSTANTS.riseMinMm;
    riseMm <= CAMERA_CONSTANTS.riseMaxMm;
    riseMm += CAMERA_CONTROL_STEPS.riseMm
  ) {
    if (interiorCornerEvaluationAtRise(riseMm).passed) return riseMm;
  }
  throw new Error("Interior Corner has no passing public Rise state");
};

describe("Free Practice teaching copy", () => {
  it("renders English scene-specific guidance and observations", () => {
    render(<TaskPanel task={null} sceneId="understanding-camera-movements" />);
    expect(
      screen.getByText(/whole-camera viewpoint movement with Front and Rear standard movements/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Front Tilt changes lens-plane orientation/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="shelf-swing" />);
    expect(screen.getByText(/Use Front Swing and Focus to align/)).toBeInTheDocument();
    expect(screen.getByText(/plane of sharp focus rotate in the Top geometry view/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="mirror-shift" />);
    expect(screen.getByText(/Separate viewpoint from framing/)).toBeInTheDocument();
    expect(screen.getByText(/Move Camera Position sideways/)).toBeInTheDocument();
    expect(screen.getByText(/opposite Front Shift/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="architecture-foreground" />);
    expect(screen.getByText(/Explore the cumulative Architecture \+ Foreground problem/)).toBeInTheDocument();
    expect(screen.getByText(/Increase Front Rise to include the roof/)).toBeInTheDocument();
    expect(screen.getByText(/Use Front Tilt to rotate the plane of sharp focus/)).toBeInTheDocument();
    expect(screen.getByText(/Adjust Focus to place that plane/)).toBeInTheDocument();
    expect(screen.getByText(/Stop down Aperture to expand usable depth/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="interior-corner" />);
    expect(screen.getByText(/Explore the neutral Interior Corner setup/)).toBeInTheDocument();
    expect(screen.getByText(/upper moulding is cropped/)).toBeInTheDocument();
    expect(screen.getByText(/Use Front Rise to move the framing upward/)).toBeInTheDocument();
    expect(screen.getByText(/same side wall from its nearer artwork/)).toBeInTheDocument();
    expect(screen.getByText(/open starting aperture/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="oblique-tabletop" />);
    expect(screen.getByText(/Use Front Tilt to improve near-to-far focus alignment/)).toBeInTheDocument();
    expect(screen.getByText(/Refine Focus after changing either movement/)).toBeInTheDocument();
    expect(screen.getByText(/Add Front Swing to resolve the remaining side-to-side difference/)).toBeInTheDocument();

    cleanup();
    render(<FeedbackPanel mode="free" sceneId="understanding-camera-movements" task={null} evaluation={null} />);
    expect(
      screen.getByText(/Whole-camera Viewpoint movement changes perspective relationships and parallax/),
    ).toBeInTheDocument();

    cleanup();
    render(<FeedbackPanel mode="free" sceneId="table-tilt" task={null} evaluation={null} />);
    const tableTiltObservation = screen.getByText(/Front Tilt rotates the plane of sharp focus/);
    expect(tableTiltObservation).toHaveTextContent(/plane of sharp focus/);
    expect(tableTiltObservation).toHaveTextContent(/Ground Glass/);
    expect(tableTiltObservation).toHaveTextContent(/depth-of-field/);
    expect(tableTiltObservation).toHaveTextContent(/Focus Targets/);
  });

  it("renders projected Rise feedback for neutral and acceptable framing in both locales", () => {
    const neutralEvaluation = interiorCornerEvaluationAtRise(0);
    render(
      <FeedbackPanel
        mode="free"
        sceneId="interior-corner"
        task={null}
        evaluation={null}
        freeCompositionEvaluation={neutralEvaluation}
      />,
    );
    expect(screen.getByTestId("interior-corner-rise-composition-feedback")).toHaveTextContent(
      /Keep the camera level.*upper architecture is still too close to the top edge/i,
    );
    expect(screen.getByText("Rise composition needs adjustment")).toBeInTheDocument();

    cleanup();
    const passingRiseMm = firstPassingInteriorCornerRise();
    render(
      <FeedbackPanel
        mode="free"
        sceneId="interior-corner"
        task={null}
        evaluation={null}
        freeCompositionEvaluation={interiorCornerEvaluationAtRise(passingRiseMm)}
      />,
    );
    expect(screen.getByTestId("interior-corner-rise-composition-feedback")).toHaveTextContent(
      /upper architecture is now inside a safer frame/i,
    );
    expect(screen.getByText("Rise composition is acceptable")).toBeInTheDocument();

    cleanup();
    changeLocale("zh-HK");
    render(
      <FeedbackPanel
        mode="free"
        sceneId="interior-corner"
        task={null}
        evaluation={null}
        freeCompositionEvaluation={neutralEvaluation}
      />,
    );
    expect(screen.getByTestId("interior-corner-rise-composition-feedback")).toHaveTextContent(
      /保持相機水平.*上方建築細節仍然太貼近畫面頂部/,
    );
    expect(screen.getByText("上移構圖仍需調整")).toBeInTheDocument();
  });

  it("renders representative zh-HK scene-specific guidance and observations", async () => {
    changeLocale("zh-HK");

    render(<TaskPanel task={null} sceneId="understanding-camera-movements" />);
    await waitFor(() => {
      expect(screen.getByText(/整部相機移動造成的視點改變與前組、後組移軸/)).toBeInTheDocument();
    });
    expect(screen.getByText(/前組傾斜與後組傾斜/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="shelf-swing" />);
    expect(screen.getByText(/前組擺動及對焦/)).toBeInTheDocument();
    expect(screen.getByText(/清晰焦平面旋轉/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="mirror-shift" />);
    expect(screen.getByText(/視點與構圖/)).toBeInTheDocument();
    expect(screen.getByText(/向相反方向使用前組橫移/)).toBeInTheDocument();
    expect(screen.getByText(/視差/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="architecture-foreground" />);
    expect(screen.getByText(/探索「建築物及前景」的累積問題/)).toBeInTheDocument();
    expect(screen.getByText(/增加前組上移，把屋頂納入畫面/)).toBeInTheDocument();
    expect(screen.getByText(/使用前組傾斜，讓清晰焦平面/)).toBeInTheDocument();
    expect(screen.getByText(/調整對焦，將焦平面放置/)).toBeInTheDocument();
    expect(screen.getByText(/收細光圈，擴大已對齊清晰焦平面周圍的實用景深/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="interior-corner" />);
    expect(screen.getByText(/在處理構圖及向後延伸牆面的對焦問題前/)).toBeInTheDocument();
    expect(screen.getByText(/上方線腳被裁切/)).toBeInTheDocument();
    expect(screen.getByText(/使用前組上移把構圖向上移動/)).toBeInTheDocument();
    expect(screen.getByText(/從較近的畫作觀察到中間及遠處的細節/)).toBeInTheDocument();
    expect(screen.getByText(/較開的起始光圈下/)).toBeInTheDocument();

    cleanup();
    render(<TaskPanel task={null} sceneId="oblique-tabletop" />);
    expect(screen.getByText(/使用前組傾斜，改善桌面近遠方向的焦平面對齊/)).toBeInTheDocument();
    expect(screen.getByText(/調整任何一個動作後，再微調對焦/)).toBeInTheDocument();
    expect(screen.getByText(/加入前組擺動，處理餘下的左右方向差異/)).toBeInTheDocument();
  });
});

describe("Movement Help", () => {
  const movementProps = {
    riseEnabled: true,
    tiltEnabled: true,
    swingEnabled: true,
    lockReason: "Disabled for this guided task",
  };

  it("describes Front Rise, Front Tilt, and Front Swing in English", () => {
    render(<MovementControls {...movementProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Help" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Movement help" })).toBeInTheDocument();
    expect(screen.getByText(/Front Rise moves the lens standard/)).toBeInTheDocument();
    expect(screen.getByText(/Front Tilt rotates the lens standard/)).toBeInTheDocument();
    expect(screen.getByText(/Front Swing rotates the lens standard/)).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getAllByText(/plane of sharp focus/)).toHaveLength(2);
    expect(screen.queryByText(/X axis|Y axis/)).not.toBeInTheDocument();
  });

  it("switches Movement Help to equivalent zh-HK terminology", async () => {
    changeLocale("zh-HK");
    render(<MovementControls {...movementProps} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "說明" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "說明" }));

    expect(screen.getByRole("heading", { name: "相機移軸說明" })).toBeInTheDocument();
    expect(screen.getByText(/前組上移/)).toBeInTheDocument();
    expect(screen.getByText(/前組傾斜/)).toBeInTheDocument();
    expect(screen.getByText(/前組擺動/)).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText(/鏡頭平面/)).toHaveLength(2);
    expect(within(dialog).getAllByText(/清晰焦平面/)).toHaveLength(2);
  });
});
