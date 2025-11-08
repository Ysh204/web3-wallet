import React, { useState, useEffect, useRef } from 'react'
import * as bip39 from 'bip39'

import { derivePath } from './ed25519Slip10'  
import { Keypair, PublicKey, Connection, SystemProgram, Transaction, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js'



function warnSecurity() {
  return (
    <div style={{ background: '#fff3cd', padding: 12, borderRadius: 6, marginTop: 8,color: '#856404' }}>
      <strong>Security warning:</strong> This demo displays your mnemonic & derives private keys in the browser.
      Do not use mnemonics produced here with mainnet funds unless you fully audit and secure the app.
    </div>
  )
}

export default function App() {
 
  const [mnemonic, setMnemonic] = useState('')
  const [index, setIndex] = useState(0)
  const [pubkey, setPubkey] = useState(null)
  const [balance, setBalance] = useState(null)
  const [networkRpc, setNetworkRpc] = useState(clusterApiUrl('devnet'))
  const [status, setStatus] = useState('')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('0.01')
  const keypairRef = useRef(null)
  const connRef = useRef(new Connection(networkRpc, 'confirmed'))

  
  useEffect(() => {
    connRef.current = new Connection(networkRpc, 'confirmed')
    
    if (pubkey) {
      fetchBalance(pubkey)
    }
  }, [networkRpc])


  const generateMnemonic = () => {
    const m = bip39.generateMnemonic(256)
    setMnemonic(m)
    setStatus('Mnemonic generated — make sure to copy it to a safe place.')
    
    setTimeout(() => deriveAccountFromMnemonic(m, 0), 50)
  }


  const importMnemonic = async () => {
    const m = prompt('Paste your 24-word mnemonic here:')
    if (!m) return
    if (!bip39.validateMnemonic(m.trim())) {
      alert('Invalid mnemonic.')
      return
    }
    setMnemonic(m.trim())
    setStatus('Mnemonic imported.')
    deriveAccountFromMnemonic(m.trim(), index)
  }

  

const deriveAccountFromMnemonic = async (mnemonicWords, acctIndex) => {
  setStatus('Deriving account...')
  try {
    if (!bip39.validateMnemonic(mnemonicWords)) {
      setStatus('Invalid mnemonic.')
      return
    }
   
    const seedBuffer = await bip39.mnemonicToSeed(mnemonicWords) 
   
    const path = `m/44'/501'/${acctIndex}'/0'`
    const node = derivePath(seedBuffer, path) 

    const kp = Keypair.fromSeed(node.key)
    keypairRef.current = kp
    const pub = kp.publicKey.toBase58()
    setPubkey(pub)
    setStatus(`Derived account index ${acctIndex}`)
    await fetchBalance(pub)
  } catch (err) {
    console.error(err)
    setStatus('Derivation failed: ' + (err.message || err.toString()))
  }
}

 
  const fetchBalance = async (pub) => {
    try {
      setBalance('loading...')
      const c = connRef.current
      const bal = await c.getBalance(new PublicKey(pub))
      setBalance((bal / LAMPORTS_PER_SOL).toString())
    } catch (err) {
      console.error(err)
      setBalance('error')
    }
  }


  const handleIndexChange = async (val) => {
    const i = Math.max(0, Math.floor(Number(val) || 0))
    setIndex(i)
    if (mnemonic && bip39.validateMnemonic(mnemonic)) {
      await deriveAccountFromMnemonic(mnemonic, i)
    } else {
      setPubkey(null)
      setBalance(null)
    }
  }

 
  const sendSol = async () => {
    setStatus('')
    if (!keypairRef.current) {
      setStatus('No derived keypair available.')
      return
    }
    if (!recipient) {
      setStatus('Recipient required.')
      return
    }
    let toPub
    try {
      toPub = new PublicKey(recipient)
    } catch {
      setStatus('Invalid recipient public key.')
      return
    }
    const amt = Number(amount)
    if (!(amt > 0)) {
      setStatus('Amount must be > 0.')
      return
    }

    try {
      setStatus('Creating transaction...')
      const connection = connRef.current
      const fromKP = keypairRef.current
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKP.publicKey,
          toPubkey: toPub,
          lamports: Math.round(amt * LAMPORTS_PER_SOL)
        })
      )

      const signature = await connection.sendTransaction(tx, [fromKP])
      setStatus(`Transaction sent. Signature: ${signature}`)
    
      await connection.confirmTransaction(signature, 'confirmed')
      setStatus(`Confirmed. Signature: ${signature}`)

      await fetchBalance(fromKP.publicKey.toBase58())
    } catch (err) {
      console.error(err)
      setStatus('Send failed: ' + (err.message || err.toString()))
    }
  }


  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Copied to clipboard.')
    } catch {
      setStatus('Copy failed — permission denied or not supported.')
    }
  }


  const requestAirdrop = async () => {
    if (!pubkey) {
      setStatus('No public key to airdrop to.')
      return
    }
    try {
      setStatus('Requesting airdrop (1 SOL)...')
      const c = connRef.current
      const sig = await c.requestAirdrop(new PublicKey(pubkey), LAMPORTS_PER_SOL)
      await c.confirmTransaction(sig, 'confirmed')
      setStatus('Airdrop complete.')
      await fetchBalance(pubkey)
    } catch (err) {
      console.error(err)
      setStatus('Airdrop failed: ' + (err.message || err.toString()))
    }
  }


  useEffect(() => {
    if (mnemonic && bip39.validateMnemonic(mnemonic)) {
      deriveAccountFromMnemonic(mnemonic, index)
    }
   
  }, [])

  return (
    <div className="app">
      <header>
        <h1>Solana React Wallet — Demo</h1>
        <p className="muted">Dev & testing only — do not use for mainnet funds.</p>
      </header>

      <section className="card">
        <h2>Seed (mnemonic)</h2>
        <div className="row">
          <button onClick={generateMnemonic}>Generate 24-word mnemonic</button>
          <button onClick={importMnemonic}>Import mnemonic</button>
          <button onClick={() => { if (mnemonic) { copyToClipboard(mnemonic) } }}>Copy mnemonic</button>
        </div>

        <textarea
          readOnly
          value={mnemonic}
          placeholder="Your mnemonic will appear here..."
          rows={3}
        />

        {warnSecurity()}
      </section>

      <section className="card">
        <h2>Derive accounts</h2>
        <div className="row">
          <label>Account index:
            <input
              type="number"
              min="0"
              value={index}
              onChange={(e) => handleIndexChange(e.target.value)}
            />
          </label>
          <button onClick={() => deriveAccountFromMnemonic(mnemonic, index)}>Derive</button>
        </div>

        <div className="infoRow">
          <div>
            <strong>Public key</strong>
            <pre className="mono">{pubkey ?? '-'}</pre>
            <div className="tinyRow">
              <button onClick={() => pubkey && copyToClipboard(pubkey)} disabled={!pubkey}>Copy</button>
            </div>
          </div>

          <div>
            <strong>Balance (SOL)</strong>
            <pre className="mono">{balance ?? '-'}</pre>
            <div className="tinyRow">
              <button onClick={() => pubkey && fetchBalance(pubkey)} disabled={!pubkey}>Refresh</button>
              <button onClick={requestAirdrop} disabled={!pubkey || !networkRpc.includes('devnet')}>Airdrop 1 SOL (Devnet)</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Send SOL</h2>
        <label>Network:
          <select value={networkRpc} onChange={(e) => setNetworkRpc(e.target.value)}>
            <option value={clusterApiUrl('devnet')}>Devnet</option>
            <option value={clusterApiUrl('testnet')}>Testnet</option>
            <option value={clusterApiUrl('mainnet-beta')}>Mainnet Beta</option>
          </select>
        </label>

        <label>Recipient public key
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient public key" />
        </label>

        <label>Amount (SOL)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.000001" />
        </label>

        <div className="row">
          <button onClick={sendSol}>Send</button>
        </div>

        <pre className="mono status">{status || '-'}</pre>
      </section>

      <footer>
        <small>Built with @solana/web3.js • bip39 • @noble/hashes by YashGaikwad</small>
      </footer>
    </div>
  )
}
