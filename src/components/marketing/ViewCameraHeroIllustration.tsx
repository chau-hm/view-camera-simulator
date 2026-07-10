import { publicAssetUrl } from "../../utils/publicAssetUrl";

export const ViewCameraHeroIllustration = () => (
  <div className="hero__illustration" aria-hidden="true">
    <picture>
      <img
        src={publicAssetUrl("assets/view-camera-hero-illustration.png")}
        alt=""
        width="1196"
        height="958"
        decoding="async"
        fetchPriority="high"
      />
    </picture>
  </div>
);

export default ViewCameraHeroIllustration;
