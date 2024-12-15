import { Box, Flex, Text } from "@chakra-ui/react";
import { ConnectWallet } from "@thirdweb-dev/react";
import React from "react";
import Link from 'next/link';

export default function Navbar() {
  return (
    <Box w="full" borderBottomWidth="1px" borderColor="gray.100">
      <Flex
        maxW="6xl"
        w="full"
        mx="auto"
        justifyContent="space-between"
        alignItems="center"
        py="5"
        px={{ base: "5", xl: "0" }}
      >
        <img src="/images/vitruveo-white.webp" alt="Vitruveo logo" style={{height: '45px'}} />


        <ConnectWallet theme="dark" />
      </Flex>
      <h2 style={{textAlign: 'center'}}><Link href="/" style={{display: 'inline-block', width: '100px', marginBottom: '10px'}}>VTRU</Link>   <Link href="/usdc" style={{display: 'inline-block', width: '100px', marginBottom: '10px'}}>USDC</Link></h2>
    </Box>

  );
}
