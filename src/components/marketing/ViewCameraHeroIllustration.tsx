import { publicAssetUrl } from "../../utils/publicAssetUrl";

const heroFallback = publicAssetUrl("assets/landing/hero.png");
const heroWebpSrcSet = [
  `${publicAssetUrl("assets/landing/hero-640.webp")} 640w`,
  `${publicAssetUrl("assets/landing/hero-1024.webp")} 1024w`,
  `${publicAssetUrl("assets/landing/hero-1672.webp")} 1672w`,
].join(", ");

export const ViewCameraHeroIllustration = () => (
  <figure className="landing-hero__artwork" aria-hidden="true">
    <picture>
      <source type="image/webp" srcSet={heroWebpSrcSet} sizes="100vw" />
      <img
        src={heroFallback}
        srcSet={`${heroFallback} 1672w`}
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
