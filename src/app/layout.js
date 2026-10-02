import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const heading = Source_Serif_4({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "neatx-ray",
  description: "AI decision support for reviewing X-rays. Not a diagnosis.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
