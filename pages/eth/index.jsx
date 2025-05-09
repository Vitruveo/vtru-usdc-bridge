import Head from "next/head";
import Navbar from "../../components/NavBar";
import SwapInput from "../../components/SwapInput";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

import {
  Button,
  Flex,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { ETHEREUM_CHAIN, VITRUVEO_CHAIN, ETHEREUM_VTRU_TOKEN_CONTRACT, VITRUVEO_VTRU_TOKEN_CONTRACT, VTRU_ABI, SUPPLY_SENTRY_ABI } from "../../const/details";
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


export default function Home(props) {

  const VITRUVEO = "vitruveo";
  const toast = useToast();
  const address = useAddress();
  const isMismatched = useNetworkMismatch();
  const switchChain = useSwitchChain();

  const vtruAbi = JSON.parse(VTRU_ABI);

  const [currentFrom, setCurrentFrom] = useState(VITRUVEO);
  const [loading, setLoading] = useState(false);

  const vitruveoProvider = new ThirdwebSDK(VITRUVEO_CHAIN);
  const ethereumProvider = new ThirdwebSDK(ETHEREUM_CHAIN);

  const [vtruCoinBalance, setVtruCoinBalance] = useState(0);
  const [vtruEthereumTokenBalance, setVtruEthereumTokenBalance] = useState(0);
  const [vtruEthereumTokenAllowance, setVtruEthereumTokenAllowance] = useState(0);
  
  const [vtruCoinValue, setVtruCoinValue] = useState("0");


  // Need to read from both networks regardless of which is connected so we fall back to SDK
  useEffect(() => {
    async function fetchBalances() {
      if (!address) {
        setVtruCoinBalance(0);
        setVtruEthereumTokenBalance(0);
        return;
      }

      try {
        const ethereumVtruContract = await ethereumProvider.getContract(ETHEREUM_VTRU_TOKEN_CONTRACT, vtruAbi);
        
        const coinBalance = await vitruveoProvider.getBalance(address);
        const vtruCoinBalance = Number(coinBalance.value);

        setVtruCoinBalance(vtruCoinBalance);

        setVtruEthereumTokenBalance(await ethereumVtruContract.call('balanceOf', [address]));
        setVtruEthereumTokenAllowance(await ethereumVtruContract.call('allowance', [address, ETHEREUM_VTRU_TOKEN_CONTRACT]));

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
      if (currentFrom === VITRUVEO) {
        props.chainSwitchHandler(VITRUVEO_CHAIN);
      } else {
        props.chainSwitchHandler(ETHEREUM_CHAIN);       
      }
    }
    activateChain();

  }, [currentFrom]);

  const toDisplay = (value) => {
    return (value/10**18).toFixed(0);
  }

  const toMaxDisplay = (value) => {
    let tmpValue = value/10**18;
    if (tmpValue >= 1) {
      tmpValue -= 1;
    } else {
      tmpValue = 0;
    }
    return (tmpValue).toFixed(0);
  }

  const inputInvalid = () => {
    if (currentFrom === VITRUVEO) {
      return Number(vtruCoinValue) > Math.trunc(Number(vtruCoinBalance/10**18)) || Number(vtruCoinValue) < 100;
    } else {
      return Number(vtruCoinValue) > Math.trunc(Number(vtruEthereumTokenBalance/10**18)) || Number(vtruCoinValue) < 100;
    }
  }

  // Approve Ethereum
  const { contract: vtruEthereumContract } = useContract(ETHEREUM_VTRU_TOKEN_CONTRACT, vtruAbi );
  const { mutateAsync: approveEthereumVtruSpending } = useContractWrite(vtruEthereumContract, "approve");

  // Bridge Ethereum
  const { mutateAsync: bridgeEthereumTokenToCoin } = useContractWrite(vtruEthereumContract, "burnVTRUToken");

  // Bridge Vitruveo
  const { contract: vtruVitruveoContract } = useContract(VITRUVEO_VTRU_TOKEN_CONTRACT, vtruAbi );
  const { mutateAsync: bridgeVitruveoCoinToToken } = useContractWrite(vtruVitruveoContract, "lockVTRUCoin");      

  const executeBridge = async () => {
    setLoading(true);
    try {
      const amount = ethers.utils.parseUnits(vtruCoinValue, 18);
      if (currentFrom === VITRUVEO) {
        if (isMismatched) {
          await switchChain(VITRUVEO_CHAIN.chainId);
        }

        await bridgeVitruveoCoinToToken({ args: [ETHEREUM_CHAIN.chainId], overrides: { value: amount }});

        toast({
          status: "success",
          title: "Coin Bridge Successful",
          description: `You have successfully bridged VTRU coins on Vitruveo to VTRU tokens on Ethereum. Funds will arrive in 2-3 mins.`,
        });
      } else {
        if (isMismatched) {
          await switchChain(ETHEREUM_CHAIN.chainId);
        }
        if (Number(vtruEthereumTokenAllowance) < amount) {
          await approveEthereumVtruSpending({ args: [ETHEREUM_VTRU_TOKEN_CONTRACT, amount] });
        }
        await bridgeEthereumTokenToCoin({ args: [VITRUVEO_CHAIN.chainId, amount] });

        toast({
          status: "success",
          title: "Token Bridge Successful",
          description: `You have successfully bridged VTRU tokens on Ethereum to VTRU coins on Vitruveo. Funds will arrive in 2-3 mins.`,
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
        <title>Vitruveo VTRU Ethereum Bridge</title>
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
              <h2 style={{fontSize: '24px', fontWeight: 600, margin: 'auto', marginBottom: '20px'}}>Vitruveo VTRU Ethereum Bridge</h2>
        <p style={{marginBottom: 5}}>The Vitruveo VTRU Bridge is a fast and easy way to bridge the VTRU coin on Vitruveo to/from the VTRU token on other chains.</p>
        <p style={{marginBottom: 10, textAlign: "center"}}><span style={{color: '#ffff33'}}>Bridge fee of 10% paused until 5 p.m. PDT, May 12, 2025</span></p>
        <Flex
          direction={currentFrom === VITRUVEO ? "column" : "column-reverse"}
          gap="3"
        >
          <SwapInput
            current={currentFrom}
            type={VITRUVEO}
            max={toMaxDisplay(vtruCoinBalance)}
            value={String(Math.trunc(Number(vtruCoinValue)).toFixed(0))}
            setValue={setVtruCoinValue}
            tokenSymbol="VTRU Coin"
            tokenBalance={toDisplay(vtruCoinBalance)}
            network="vitruveo"
          />

          <Button
            onClick={() =>
              currentFrom === VITRUVEO
                ? setCurrentFrom("ethereum")
                : setCurrentFrom(VITRUVEO)
            }
            maxW="5"
            mx="auto"
          >
            ↓
          </Button>

          <SwapInput
            current={currentFrom}
            type="ethereum"
            max={toMaxDisplay(vtruEthereumTokenBalance)}
            value={String(Math.trunc(Number(vtruCoinValue)).toFixed(0))}
            setValue={setVtruCoinValue}
            tokenSymbol="VTRU Token"
            tokenBalance={toDisplay(vtruEthereumTokenBalance)}
            network="ethereum"
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
            {loading ? <Spinner /> : (Math.trunc(Number(vtruCoinValue)) < 100 ? 'Bridge Minimum: 100' : ` Bridge ${currentFrom == VITRUVEO ? 'Coin' : 'Token'}`)}
          </Button>
        ) : (
          <ConnectWallet
            style={{ padding: "20px 0px", fontSize: "18px" }}
            theme="dark"
          />
        )}
        <p style={{textAlign: "center"}}>View in-flight bridge transactions at <a href="https://scan.vialabs.io" target="_new" style={{textDecoration: 'underline'}}>https://scan.vialabs.io</a></p>
      </Flex>
      <div style={{textAlign: 'center', fontSize: '14px', marginTop: '5px'}}>Powered by <a href='https://vialabs.io/' target='_new'>VIA Labs</a>. &nbsp; &nbsp; Built with 💜 by <a href="https://www.vitruveo.xyz" target="_new">Vitruveo</a>.</div>
    </>
  );
}
