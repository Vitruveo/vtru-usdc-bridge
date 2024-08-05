import { POLYGON_CHAIN, VITRUVEO_CHAIN } from "../const/details";
import { ChakraProvider } from "@chakra-ui/react";
import { ThirdwebProvider } from "@thirdweb-dev/react";
import type { AppProps } from "next/app";
import { useState } from "react";
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {

  const [activeChain, setActiveChain] = useState(POLYGON_CHAIN);

  const handleChainSwitch:any = (chain:any) => {
    setActiveChain(chain);
  }

  return (

    <ThirdwebProvider
      clientId={process.env.NEXT_PUBLIC_CLIENT_ID}
      activeChain={activeChain}
      supportedChains={[POLYGON_CHAIN, VITRUVEO_CHAIN]}
    >
      <ChakraProvider>
        <Component {...pageProps} chainSwitchHandler={handleChainSwitch} />
      </ChakraProvider>
    </ThirdwebProvider>
  );
}
