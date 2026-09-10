import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Gitgrove — Tu código, con perspectiva",
  description:
    "Explorá las ramas, commits y cambios de tus repositorios. Una app local y privada para tu Mac.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
