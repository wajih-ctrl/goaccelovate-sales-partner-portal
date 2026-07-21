type BrandLogoProps = {
  tone?: "black" | "white";
  className?: string;
};

export function BrandLogo({ tone = "black", className }: BrandLogoProps) {
  return (
    <img
      src={tone === "white" ? "/Tagline-Version.png" : "/Tagline-Black.png"}
      alt="GoAccelovate"
      className={className}
    />
  );
}
