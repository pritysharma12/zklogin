import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { SuiClient } from "@mysten/sui.js/client";
import GoogleLogo from "../../google.svg";
import queryString from "query-string";
import { JwtPayload, jwtDecode } from "jwt-decode";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { MIST_PER_SUI } from "@mysten/sui.js/utils";
import { SerializedSignature } from "@mysten/sui.js/cryptography";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useLocation } from "react-router-dom";
import { BigNumber } from "bignumber.js";
import { fromB64 } from "@mysten/bcs";
import { computeZkLoginAddressFromSeed } from "@mysten/sui.js/zklogin";
// import { generateMnemonic, validateMnemonic } from 'bip39';
// import { Buffer } from 'buffer-es6';
import {
  genAddressSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
} from "@mysten/zklogin";
import {
  FULLNODE_URL,
  CLIENT_ID,
  KEY_PAIR_SESSION_STORAGE_KEY,
  MAX_EPOCH_LOCAL_STORAGE_KEY,
  RANDOMNESS_SESSION_STORAGE_KEY,
  REDIRECT_URI,
  SUI_DEVNET_FAUCET,
  SUI_PROVER_DEV_ENDPOINT,
  USER_SALT_LOCAL_STORAGE_KEY,
  EXTENDED_KEY,
} from "../../constant";
import axios from "axios";
import { enqueueSnackbar } from "notistack";
import { LoadingButton } from "@mui/lab";
export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>["0"]["inputs"],
  "addressSeed"
>;

const suiClient = new SuiClient({ url: FULLNODE_URL });
function LoginComponent() {
  const [ephemeralKeyPair, setEphemeralKeyPair] = useState<Ed25519Keypair>();
  const [oauthParams, setOauthParams] =
    useState<queryString.ParsedQuery<string>>();
  const [jwtString, setJwtString] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [decodedJwt, setDecodedJwt] = useState<JwtPayload>();
  const [userSalt, setUserSalt] = useState<string>();
  const [zkProof, setZkProof] = useState<PartialZkLoginSignature>();
  const [zkLoginUserAddress, setZkLoginUserAddress] = useState("");

  const [nonce, setNonce] = useState("");
  const [extendedEphemeralPublicKey, setExtendedEphemeralPublicKey] =
    useState("");
  const [fetchingZKProof, setFetchingZKProof] = useState(false);
  const [maxEpoch, setMaxEpoch] = useState(0);
  const [randomness, setRandomness] = useState("");
  const [executingTxn, setExecutingTxn] = useState(false);
  const [executeDigest, setExecuteDigest] = useState("");

  // query jwt id_token
  const [requestingFaucet, setRequestingFaucet] = useState(false);
  const requestFaucet = async () => {
    if (!zkLoginUserAddress) {
      return;
    }
    try {
      setRequestingFaucet(true);
      await axios.post(SUI_DEVNET_FAUCET, {
        FixedAmountRequest: {
          recipient: zkLoginUserAddress,
        },
      });
      enqueueSnackbar("Success!", {
        variant: "success",
      });
    } catch (error) {
      enqueueSnackbar(String(error), {
        variant: "error",
      });
    } finally {
      setRequestingFaucet(false);
    }
  };

  const location = useLocation();

  useEffect(() => {
    const res = queryString.parse(location.hash);
    setOauthParams(res);
  }, [location]);

  useEffect(() => {
    if (oauthParams && oauthParams.id_token) {
      const decodedJwt = jwtDecode(oauthParams.id_token as string);
      setJwtString(oauthParams.id_token as string);
      setDecodedJwt(decodedJwt);
      setActiveStep(1);

      // check previous salt
      let salt = window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY);
      if (!salt) {
        // generating salt
        salt = generateRandomness();
        window.localStorage.setItem(USER_SALT_LOCAL_STORAGE_KEY, salt);
        setUserSalt(salt);
      }
      if (!salt || !oauthParams.id_token) {
        return;
      }
      // user address
      const zkLoginUserAddress = jwtToAddress(
        oauthParams.id_token as string,
        salt
      );
      setZkLoginUserAddress(zkLoginUserAddress);

      addressBalance(zkLoginUserAddress)
        .then((totalBalance) => {
          window.sessionStorage.setItem("balance", totalBalance);
        })
        .catch((error) => {
          console.error("Error:", error);
        });

      const serializedKeyPair = window.localStorage.getItem(
        KEY_PAIR_SESSION_STORAGE_KEY
      );

      if (serializedKeyPair) {
        const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(
          fromB64(serializedKeyPair)
        );

        setEphemeralKeyPair(ephemeralKeyPair);
        const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
          ephemeralKeyPair.getPublicKey()
        );

        window.localStorage.setItem(EXTENDED_KEY, extendedEphemeralPublicKey);
        setExtendedEphemeralPublicKey(extendedEphemeralPublicKey);
      }
    }
  }, [oauthParams]);

  // query zkLogin address balance
  const addressBalance = async (wallet: string) => {
    try {
      const bal = await suiClient.getBalance({ owner: wallet });
      return bal.totalBalance;
    } catch (error) {
      // Handle the error here
      console.error("Error fetching balance:", error);
      throw error;
    }
  };

  function calculateHydroBalance() {
    // Retrieve the value from sessionStorage
    const addressBalance = sessionStorage.getItem("balance");

    // Check if the value exists
    if (addressBalance) {
      // Perform calculations on the retrieved value
      const totalBalance = BigNumber(addressBalance)
        .div(MIST_PER_SUI.toString())
        .toFixed(6);

      // Concatenate the result with " SUI"
      const result = totalBalance + " SUI";

      // Return the result
      return result;
    } else {
      // If the value doesn't exist in sessionStorage, return "0 SUI"
      return "0 SUI";
    }
  }
  // const { data: addressBalance } = useSuiClientQuery(
  //   "getBalance",
  //   {
  //     owner: zkLoginUserAddress,
  //   },
  //   {
  //     enabled: Boolean(zkLoginUserAddress),
  //     refetchInterval: 1500,
  //   }
  // );

  return (
    <div>
      {activeStep === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "80vh",
          }}
        >
          <Button
            sx={{
              mt: "24px",
            }}
            variant="contained"
            onClick={async () => {
              // const addressSeed: string = genAddressSeed(
              //   "306407678259487695878142978028805670726", //salt
              //   "sub",
              //   "109482427028375191762", // decodedJwt.sub,
              //   "573120070871-0k7ga6ns79ie0jpg1ei6ip5vje2ostt6.apps.googleusercontent.com"
              //   // decodedJwt.aud as string
              // ).toString();

              // console.log("addressSeed : ",addressSeed)
              // const address = computeZkLoginAddressFromSeed(BigInt(addressSeed),"https://accounts.google.com")
              // console.log("address : ",address)
              const ephemeralKeyPair = Ed25519Keypair.generate();
              window.sessionStorage.setItem(
                KEY_PAIR_SESSION_STORAGE_KEY,
                ephemeralKeyPair.export().privateKey
              );
              window.localStorage.setItem(
                KEY_PAIR_SESSION_STORAGE_KEY,
                ephemeralKeyPair.export().privateKey
              );
              setEphemeralKeyPair(ephemeralKeyPair);

              // Step 2: Fetch Current Epoch
              const { epoch } = await suiClient.getLatestSuiSystemState();
              window.localStorage.setItem(
                MAX_EPOCH_LOCAL_STORAGE_KEY,
                String(Number(epoch) + 1)
              );
              setMaxEpoch(Number(epoch) + 1);

              // Step 3: Generate Randomness
              const randomness = generateRandomness();
              window.sessionStorage.setItem(
                RANDOMNESS_SESSION_STORAGE_KEY,
                randomness
              );
              window.localStorage.setItem(
                RANDOMNESS_SESSION_STORAGE_KEY,
                randomness
              );
              setRandomness(randomness);

              // Step 4: Generate Nonce
              const nonce = generateNonce(
                ephemeralKeyPair.getPublicKey(),
                Number(
                  window.localStorage.getItem(MAX_EPOCH_LOCAL_STORAGE_KEY)
                ),
                randomness
              );
              setNonce(nonce);

              const params = new URLSearchParams({
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                response_type: "id_token",
                scope: "openid",
                nonce: nonce,
              });
              const loginURL = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
              window.location.replace(loginURL);
            }}
          >
            <img
              src={GoogleLogo}
              width="16px"
              style={{
                marginRight: "8px",
              }}
              alt="Google"
            />{" "}
            Sign In With Google
          </Button>
        </div>
      )}

      {activeStep === 1 && (
        <div>
          <Box>
            <Typography
              sx={{
                fontSize: "1.25rem",
                fontWeight: 600,
                mb: "12px !important",
              }}
            >
              Decode JWT
            </Typography>
            {decodedJwt && (
              <Alert
                variant="standard"
                color="success"
                sx={{
                  fontWeight: 600,
                }}
              >
                Successfully logged in via Google!
              </Alert>
            )}
            <SyntaxHighlighter wrapLongLines wrapLines language="typescript">
              {`// id_token Header.Payload.Signature
${JSON.stringify(jwtString)}`}
            </SyntaxHighlighter>
            <SyntaxHighlighter wrapLongLines language="json">
              {JSON.stringify(decodedJwt, null, 2) !== undefined
                ? `// JWT Payload
${JSON.stringify(decodedJwt, null, 2)}`
                : "Not Available"}
            </SyntaxHighlighter>
            <Stack
              spacing={1}
              sx={{
                m: "24px 0",
              }}
            >
              <Typography>
                <code>iss (issuer)</code>：<b>Issuer</b>
              </Typography>
              <Typography>
                <code>aud (audience)</code>：<b>JWT Consumer (CLIENT_ID)</b>
              </Typography>
              <Typography>
                <code>sub (subject)</code>：
                <b>Subject (user identifier, unique for each user)</b>
              </Typography>
              <Typography>
                <code>nonce</code>：Signature order (values generated by
                assembling URL parameters earlier)
              </Typography>
              <Typography>
                <code>nbf (Not Before)</code>：Issued At
              </Typography>
              <Typography>
                <code>iat(Issued At)</code>：Issued Time
              </Typography>
              <Typography>
                <code>exp (expiration time)</code>：Expiration Time
              </Typography>
              <Typography>
                <code>jti (JWT ID)</code>：JWT ID
              </Typography>
            </Stack>
          </Box>
          <div>
            <p>
              <b>User Salt:</b>{" "}
              {localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY)}
            </p>
            <p>
              <b>User Hydro Address:</b>{" "}
              {zkLoginUserAddress ? zkLoginUserAddress : ""}
            </p>
            <p>
              <b>Balance:</b> {calculateHydroBalance()}
            </p>
            <p>
              <b>extendedEphemeralPublicKey:</b>{" "}
              {extendedEphemeralPublicKey ? extendedEphemeralPublicKey : ""}
            </p>
            <br />
            <LoadingButton
              variant="contained"
              sx={{
                ml: "24px",
              }}
              size="small"
              loading={requestingFaucet}
              disabled={!zkLoginUserAddress}
              onClick={requestFaucet}
            >
              Request Test Hydro Token
            </LoadingButton>
          </div>
          {
            <Stack spacing={2}>
              <Typography
                sx={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  mb: "12px !important",
                }}
              >
                Fetch ZK Proof (Groth16)
              </Typography>
              <LoadingButton
                loading={fetchingZKProof}
                variant="contained"
                disabled={
                  !oauthParams?.id_token ||
                  !window.localStorage.getItem(EXTENDED_KEY) ||
                  !window.localStorage.getItem(MAX_EPOCH_LOCAL_STORAGE_KEY) ||
                  !window.localStorage.getItem(
                    RANDOMNESS_SESSION_STORAGE_KEY
                  ) ||
                  !window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY)
                }
                onClick={async () => {
                  try {
                    setFetchingZKProof(true);
                    const zkProofResult = await axios.post(
                      SUI_PROVER_DEV_ENDPOINT,
                      {
                        jwt: oauthParams?.id_token as string,
                        extendedEphemeralPublicKey:
                          window.localStorage.getItem(EXTENDED_KEY),
                        maxEpoch: Number(
                          window.localStorage.getItem(
                            MAX_EPOCH_LOCAL_STORAGE_KEY
                          )
                        ),
                        jwtRandomness: window.localStorage.getItem(
                          RANDOMNESS_SESSION_STORAGE_KEY
                        ),
                        salt: window.localStorage.getItem(
                          USER_SALT_LOCAL_STORAGE_KEY
                        ),
                        keyClaimName: "sub",
                      },
                      {
                        headers: {
                          "Content-Type": "application/json",
                        },
                      }
                    );
                    setZkProof(zkProofResult.data as PartialZkLoginSignature);
                    enqueueSnackbar("Successfully obtain ZK Proof", {
                      variant: "success",
                    });
                  } catch (error: any) {
                    console.error("error ", error);
                    enqueueSnackbar(
                      String(error?.response?.data?.message || error),
                      {
                        variant: "error",
                      }
                    );
                  } finally {
                    setFetchingZKProof(false);
                  }
                }}
              >
                Fetch ZK Proof
              </LoadingButton>
              {zkProof && (
                <SyntaxHighlighter wrapLongLines language="typescript">
                  {JSON.stringify(zkProof, null, 2)}
                </SyntaxHighlighter>
              )}
            </Stack>
          }
          {/* Step 7 */}
          <br />
          {
            <Box>
              <div className="card">
                <LoadingButton
                  sx={{
                    ml: "24px",
                  }}
                  size="small"
                  loading={executingTxn}
                  variant="contained"
                  disabled={!decodedJwt}
                  onClick={async () => {
                    try {
                      console.log("ephemeralKeyPair",ephemeralKeyPair)
                      console.log("zkProof",zkProof)
                      console.log("decodedJwt",decodedJwt)
                      console.log("userSalt",userSalt)
                      const salt = window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY)
                      console.log("salt",salt)
                      if (
                        !ephemeralKeyPair ||
                        !zkProof ||
                        !decodedJwt ||
                        !salt
                      ) {
                        return;
                      }
                      setExecutingTxn(true);
                      const txb = new TransactionBlock();

                      const [coin] = txb.splitCoins(txb.gas, [
                        MIST_PER_SUI * BigInt(1),
                      ]);
                      txb.transferObjects(
                        [coin],
                        "0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36"
                      );
                      txb.setSender(zkLoginUserAddress);

                      const { bytes, signature: userSignature } =
                        await txb.sign({
                          client: suiClient,
                          signer: ephemeralKeyPair, // This must be the same ephemeral key pair used in the ZKP request
                        });
                      if (!decodedJwt?.sub || !decodedJwt.aud) {
                        return;
                      }

                      const addressSeed: string = genAddressSeed(
                        BigInt(salt),
                        "sub",
                        decodedJwt.sub,
                        decodedJwt.aud as string
                      ).toString();

                      setMaxEpoch(
                        Number(
                          window.localStorage.getItem(
                            MAX_EPOCH_LOCAL_STORAGE_KEY
                          )
                        )
                      );

                      console.log("epoch ",maxEpoch)
                      const signatureExpiry = Number(window.localStorage.getItem(
                        MAX_EPOCH_LOCAL_STORAGE_KEY
                      ));

                      console.log("epoch signatureExpiry ",signatureExpiry)

                      const zkLoginSignature: SerializedSignature =
                        getZkLoginSignature({
                          inputs: {
                            ...zkProof,
                            addressSeed,
                          },
                          maxEpoch: signatureExpiry,
                          userSignature,
                        });

                      const executeRes =
                        await suiClient.executeTransactionBlock({
                          transactionBlock: bytes,
                          signature: zkLoginSignature,
                        });

                      enqueueSnackbar(
                        `Execution successful: ${executeRes.digest}`,
                        {
                          variant: "success",
                        }
                      );
                      console.log("executeRes.digest")
                      localStorage.setItem("response",executeRes.digest)
                      setExecuteDigest(executeRes.digest);
                    } catch (error) {
                      console.error(error);
                      enqueueSnackbar(String(error), {
                        variant: "error",
                      });
                    } finally {
                      setExecutingTxn(false);
                    }
                  }}
                >
                  Execute Transaction Block
                </LoadingButton>
                {localStorage.getItem("response") && (
                  <Alert severity="success" sx={{ mt: "12px" }}>
                    Execution successful:{" "}
                    <Typography
                      component="span"
                      sx={{
                        fontFamily: "'Noto Sans Mono', monospace;",
                        fontWeight: 600,
                      }}
                    >
                      <a
                        href={`https://suiexplorer.com/txblock/${localStorage.getItem("response")}?network=devnet`}
                        target="_blank"
                      >
                        {localStorage.getItem("response")}
                      </a>
                    </Typography>
                  </Alert>
                )}
              </div>
            </Box>
          }
        </div>
      )}
    </div>
  );
}
export default LoginComponent;
