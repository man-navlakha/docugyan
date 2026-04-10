import { Space_Grotesk } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata = {
  title: "DocuGyan",
  description: "Your document AI assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={spaceGrotesk.className}>
        {/* Google OAuth Provider wrapping the entire app */}
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"}>
          {children}
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}