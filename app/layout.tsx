import "./(interface)/styles/globals.css";
import App from "./(interface)/App";

export const metadata = {
  title: "My App",
  description: "Generated from Figma",
  icons: {
    icon: "/assets/folder-fox.png",
  },
};

export default function RootLayout() {
  return (
    <html lang="en">
      <body>
        <App />
      </body>
    </html>
  );
}
