import { Inter } from 'next/font/google';
import { Montserrat, Fira_Sans, Noto_Sans_Georgian, Comfortaa, Sora} from 'next/font/google'
 
export const inter = Inter({ subsets: ['latin'] });
export const myFont = Montserrat({
    weight: ["400", "700"],
    subsets: ["latin"],
    preload: true,
  });