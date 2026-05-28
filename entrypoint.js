// Polyfills MUST load before anything else (order matters), then the router.
// Required by @privy-io/expo (crypto + ethers shims). From Privy's expo-starter.
import "react-native-get-random-values";
import "@ethersproject/shims";
import { Buffer } from "buffer";

global.Buffer = global.Buffer || Buffer;

import "expo-router/entry";
