type BrandLogoProps = {
  tone?: "black" | "white";
  className?: string;
};

export function BrandLogo({ tone = "black", className }: BrandLogoProps) {
  return (
    <span
      className={`relative inline-block aspect-[4.25/1] shrink-0 overflow-hidden ${className || ""}`}
      role="img"
      aria-label="GoAccelovate"
    >
      <img
        src={tone === "white" ? "/Tagline-Version.png" : "/Tagline-Black.png"}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-[1.35] object-contain"
      />
    </span>
  );
}
