import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MovementControls } from "../../components/controls/MovementControls";
import { FeedbackPanel } from "../../components/simulator/FeedbackPanel";
import { TaskPanel } from "../../components/simulator/TaskPanel";
import { changeLocale, i18n } from "../../i18n";
import { LOCALE_STORAGE_KEY } from "../../i18n/localePreference";

const resetLocale = async () => {
  cleanup();
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage("en");
  document.documentElement.lang = "en";
};

beforeEach(resetLocale);
afterEach(resetLocale);

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
