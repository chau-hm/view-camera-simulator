import { publicAssetUrl } from "../../utils/publicAssetUrl";

export const ViewCameraHeroIllustration = () => (
  <figure className="landing-hero__artwork" aria-hidden="true">
    <picture>
      <img
        src={publicAssetUrl("assets/landing/hero.png")}
        alt=""
        width="1672"
        height="941"
        decoding="async"
        fetchPriority="high"
        sizes="100vw"
      />
    </picture>
  </figure>
);

export default ViewCameraHeroIllustration;
