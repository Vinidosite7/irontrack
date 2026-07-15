import RegisterSW from "../components/RegisterSW";

export const metadata = {
  title: "IronTrack",
  description: "Treino, dieta e evolução — sem desculpa.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IronTrack",
  },
  icons: {
    apple: "/icon-180.png",
    icon: "/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#0a0c10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#0a0c10", minHeight: "100vh" }}>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
