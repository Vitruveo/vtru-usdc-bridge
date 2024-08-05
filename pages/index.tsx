import Head from "next/head";
import Navbar from "../components/NavBar";
import SwapInput from "../components/SwapInput";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";

import {
  Button,
  Flex,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { POLYGON_CHAIN, VITRUVEO_CHAIN, VIA_POLYGON_CONTRACT, VIA_VITRUVEO_CONTRACT, USDCPOL_TOKEN_CONTRACT, USDC_TOKEN_CONTRACT, VIA_ABI, USDC_ABI } from "../const/details";
import {
  ConnectWallet,
  useAddress,
  useContract,
  useContractWrite,
  useNetworkMismatch,
  useSwitchChain
} from "@thirdweb-dev/react";
import { useState, useEffect } from "react";
import { _0xhashTestnet } from "@thirdweb-dev/chains";

interface Props {
  chainSwitchHandler: Function
}

export default function Home(props:Props) {

  const toast = useToast();
  const address = useAddress();
  const isMismatched = useNetworkMismatch();
  const switchChain = useSwitchChain();

  const usdcAbi = JSON.parse(USDC_ABI);
  const viaAbi = JSON.parse(VIA_ABI);

  const [usdcBalance, setUsdcBalance] = useState(0);
  const [usdcPolBalance, setUsdcPolBalance] = useState(0);
  const [usdcAllowance, setUsdcAllowance] = useState(0);
  const [usdcPolAllowance, setUsdcPolAllowance] = useState(0);
  
  const [usdcValue, setUsdcValue] = useState<string>("0");

  const [currentFrom, setCurrentFrom] = useState<string>("usdc");
  const [loading, setLoading] = useState<boolean>(false);

  const polygonProvider = new ThirdwebSDK(POLYGON_CHAIN);
  const vitruveoProvider = new ThirdwebSDK(VITRUVEO_CHAIN);

  
  // Need to read from both networks regardless of which is connected so we fall back to SDK
  useEffect(() => {
    async function fetchBalances() {
      if (!address) {
        setUsdcBalance(0);
        setUsdcPolBalance(0);
        return;
      }

      try {
        const polygonUSDC = await polygonProvider.getContract(USDC_TOKEN_CONTRACT, usdcAbi);
        const vitruveoUSDC = await vitruveoProvider.getContract(USDCPOL_TOKEN_CONTRACT, usdcAbi);
        
        setUsdcBalance(await polygonUSDC.call('balanceOf', [address]));
        setUsdcPolBalance(await vitruveoUSDC.call('balanceOf', [address]));
  
        setUsdcAllowance(await polygonUSDC.call('allowance', [address, VIA_POLYGON_CONTRACT]));
        setUsdcPolAllowance(await vitruveoUSDC.call('allowance', [address, VIA_VITRUVEO_CONTRACT]));        
      } catch(e) {

      }
    }

    const interval = setInterval(() => {
      fetchBalances()
    }, loading ? 5000 : 15000);

    fetchBalances();

    return () => clearInterval(interval);
  
  }, [address, loading]);


  useEffect(() => {
    async function activateChain() {
      if (currentFrom === "usdc") {
        props.chainSwitchHandler(POLYGON_CHAIN);
      } else {
        props.chainSwitchHandler(VITRUVEO_CHAIN);       
      }
    }
    activateChain();

  }, [currentFrom]);

  const toDisplay = (value:number) => {
    return (value/10**6).toFixed(2);
  }

  const inputInvalid = () => {
    let tooBig = true;
    if (currentFrom === 'usdc') {
      tooBig = (Number(usdcValue) - 0.25) > Number(usdcBalance/10**6);
    } else {
      tooBig = (Number(usdcValue) - 0.25) > Number(usdcPolBalance/10**6);
    }
    return Number(usdcValue) <= 0.25 || tooBig;
  }

  // Approve Polygon
  const { contract: usdcContract } = useContract(USDC_TOKEN_CONTRACT, usdcAbi );
  const { mutateAsync: approveUsdcSpending } = useContractWrite(usdcContract, "approve");

  // Bridge Polygon
  const { contract: viaPolygonContract } = useContract(VIA_POLYGON_CONTRACT, viaAbi );
  const { mutateAsync: bridgeUSDCToUSDCPOL } = useContractWrite(viaPolygonContract, "bridge");

  // Approve Vitruveo
  const { contract: usdcPolContract } = useContract(USDCPOL_TOKEN_CONTRACT, usdcAbi);
  const { mutateAsync: approveUsdcPolSpending } = useContractWrite(usdcPolContract, "approve");        

  // Bridge Vitruveo
  const { contract: viaVitruveoContract } = useContract(VIA_VITRUVEO_CONTRACT, viaAbi );
  const { mutateAsync: bridgeUSDCPOLToUSDC } = useContractWrite(viaVitruveoContract, "bridge");      

  const executeBridge = async () => {
    setLoading(true);
    try {
      const amount = Number(usdcValue) * 10**6;
      if (currentFrom === "usdc") {
        if (isMismatched) {
          await switchChain(POLYGON_CHAIN.chainId);
        }
          
        if (Number(usdcAllowance) < amount) {
          await approveUsdcSpending({args: [VIA_POLYGON_CONTRACT, amount] });
        }

        await bridgeUSDCToUSDCPOL({ args: [address, amount] });

        // Fund gas for account
        const requestHeaders: HeadersInit = new Headers();
        requestHeaders.set('Content-Type', 'application/json');
        requestHeaders.set('X-Api-Key', String(process.env.API_KEY));

        await fetch('http://scope.vitruveo.xyz/api/hydrate', {
                                        method: 'POST',
                                        headers: requestHeaders,
                                        body: JSON.stringify({address: address}),
                                    });

        toast({
          status: "success",
          title: "Bridge Successful",
          description: `You have successfully bridged your USDC from Polygon to USDC.pol on Vitruveo. Funds will arrive in 2-3 mins.`,
        });
      } else {
        if (!isMismatched) {
          await switchChain(VITRUVEO_CHAIN.chainId);
        }
        if (Number(usdcPolAllowance) < amount) {
          await approveUsdcPolSpending({ args: [VIA_VITRUVEO_CONTRACT, amount] });
        }
        await bridgeUSDCPOLToUSDC({ args: [address, amount] });

        toast({
          status: "success",
          title: "Bridge Successful",
          description: `You have successfully bridged your USDC.pol from Vitruveo to USDC on Polygon. Funds will arrive in 2-3 mins.`,
        });
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast({
        status: "error",
        title: "Bridge Failed",
        description:
          "There was an error. Please try again.",
      });
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Vitruveo USDC Bridge</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <Flex
        direction="column"
        gap="5"
        mt="10"
        p="5"
        mx="auto"
        maxW={{ base: "sm", md: "xl" }}
        w="full"
        rounded="2xl"
        borderWidth="1px"
        borderColor="gray.600"
      >
              <h2 style={{fontSize: '24px', fontWeight: 600, margin: 'auto', marginBottom: '20px'}}>Vitruveo USDC Bridge</h2>
        <p style={{marginBottom: 10}}>The Vitruveo USDC Bridge is a fast and easy way to bridge USDC (Polygon) to/from USDC.pol (Vitruveo).</p>
        <Flex
          direction={currentFrom === "usdc" ? "column" : "column-reverse"}
          gap="3"
        >
          <SwapInput
            current={currentFrom}
            type="usdc"
            max={toDisplay(usdcBalance)}
            value={String(currentFrom === 'usdc' ? Math.floor(Number(usdcValue)).toFixed(0) : Math.max(0,Math.floor(Number(usdcValue))-0.25).toFixed(2))}
            setValue={setUsdcValue}
            tokenSymbol="USDC"
            tokenBalance={toDisplay(usdcBalance)}
            network="polygon"
          />

          <Button
            onClick={() =>
              currentFrom === "usdc"
                ? setCurrentFrom("usdcpol")
                : setCurrentFrom("usdc")
            }
            maxW="5"
            mx="auto"
          >
            ↓
          </Button>

          <SwapInput
            current={currentFrom}
            type="usdcpol"
            max={toDisplay(usdcPolBalance)}
            value={String(currentFrom === 'usdcpol' ? Math.floor(Number(usdcValue)).toFixed(0) : Math.max(0,Math.floor(Number(usdcValue))-0.25).toFixed(2))}
            setValue={setUsdcValue}
            tokenSymbol="USDC.pol"
            tokenBalance={toDisplay(usdcPolBalance)}
            network="vitruveo"
            />
        </Flex>

        {address ? (
          <Button
            onClick={executeBridge}
            py="7"
            fontSize="2xl"
            colorScheme="purple"
            rounded="xl"
            isDisabled={loading || inputInvalid()}
            style={{ fontWeight: 400, background: 'linear-gradient(106.4deg, rgb(255, 104, 192) 11.1%, rgb(104, 84, 249) 81.3%)', color: '#ffffff'}}
          >
            {/* <img src='/images/usdc-logo.png' style={{width: '30px', marginRight: '10px'}} /> */}
            {loading ? <Spinner /> : " Bridge Token"}
          </Button>
        ) : (
          <ConnectWallet
            style={{ padding: "20px 0px", fontSize: "18px" }}
            theme="dark"
          />
        )}
        <p><sup>*</sup> Each bridge transfer takes 2-3 mins and costs US$0.25 plus gas.</p>
      </Flex>
      <div style={{textAlign: 'center', fontSize: '14px', marginTop: '5px'}}><a href="https://www.circle.com/blog/bridged-usdc-standard" target="_new" style={{textDecoration: 'underline'}}>Bridged USDC Standard</a> powered by <a href='https://cryptolink.tech/' target='_new'>VIA Labs</a>. &nbsp; &nbsp; Built with 💜 by <a href="https://www.vitruveo.xyz" target="_new">Vitruveo</a>.</div>
    </>
  );
}
