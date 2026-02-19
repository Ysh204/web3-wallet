import React, { useState, useEffect, useRef } from 'react'
import * as bip39 from 'bip39'
import { derivePath } from './ed25519Slip10'
import {
    Keypair,
    PublicKey,
    Connection,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
    clusterApiUrl,
} from '@solana/web3.js'

const ALCHEMY_URL = import.meta.env.VITE_ALCHEMY_URL;

/* ── Types ── */
type StatusKind = '' | 'success' | 'error' | 'loading'

/* ── Helpers ── */
function statusClass(kind: StatusKind) {
    if (kind === 'success') return 'status-bar status-success'
    if (kind === 'error') return 'status-bar status-error'
    if (kind === 'loading') return 'status-bar status-loading'
    return 'status-bar'
}

/* ── Component ── */
export default function App() {
    const [mnemonic, setMnemonic] = useState('')
    const [index, setIndex] = useState(0)
    const [pubkey, setPubkey] = useState<string | null>(null)
    const [balance, setBalance] = useState<string | null>(null)
    const [networkRpc, setNetworkRpc] = useState(ALCHEMY_URL || '')
    const [status, setStatus] = useState('')
    const [statusKind, setStatusKind] = useState<StatusKind>('')
    const [recipient, setRecipient] = useState('')
    const [amount, setAmount] = useState('0.01')
    const [showMnemonic, setShowMnemonic] = useState(true)
    const [showImportModal, setShowImportModal] = useState(false)
    const [importText, setImportText] = useState('')
    const [importError, setImportError] = useState('')
    const [wordCount, setWordCount] = useState<12 | 24>(12)

    const keypairRef = useRef<Keypair | null>(null)
    const connRef = useRef(new Connection(networkRpc, 'confirmed'))

    /* ── Status helpers ── */
    const info = (msg: string) => { setStatus(msg); setStatusKind('') }
    const success = (msg: string) => { setStatus(msg); setStatusKind('success') }
    const error = (msg: string) => { setStatus(msg); setStatusKind('error') }
    const loading = (msg: string) => { setStatus(msg); setStatusKind('loading') }

    /* ── Network change ── */
    useEffect(() => {
        connRef.current = new Connection(networkRpc, 'confirmed')
        if (pubkey) fetchBalance(pubkey)
    }, [networkRpc])

    /* ── Generate mnemonic ── */
    const generateMnemonic = () => {
        const entropy = wordCount === 12 ? 128 : 256
        const m = bip39.generateMnemonic(entropy)
        setMnemonic(m)
        setShowMnemonic(true)
        success(`${wordCount}-word mnemonic generated — copy it to a safe place.`)
        setTimeout(() => deriveAccount(m, 0), 50)
    }

    /* ── Import modal ── */
    const openImportModal = () => {
        setImportText('')
        setImportError('')
        setShowImportModal(true)
    }
    const confirmImport = () => {
        const trimmed = importText.trim()
        if (!bip39.validateMnemonic(trimmed)) {
            setImportError('Invalid mnemonic — must be 12 or 24 valid words.')
            return
        }
        setMnemonic(trimmed)
        setShowImportModal(false)
        setShowMnemonic(true)
        success('Mnemonic imported.')
        deriveAccount(trimmed, index)
    }

    /* ── Derive ── */
    const deriveAccount = async (words: string, acctIndex: number) => {
        loading('Deriving account…')
        try {
            if (!bip39.validateMnemonic(words)) { error('Invalid mnemonic.'); return }
            const seed = await bip39.mnemonicToSeed(words)
            const path = `m/44'/501'/${acctIndex}'/0'`
            const node = derivePath(seed, path)
            const kp = Keypair.fromSeed(node.key)
            keypairRef.current = kp
            const pub = kp.publicKey.toBase58()
            setPubkey(pub)
            success(`Derived account #${acctIndex}`)
            await fetchBalance(pub)
        } catch (err: any) {
            console.error(err)
            error('Derivation failed: ' + (err.message ?? err))
        }
    }

    /* ── Balance ── */
    const fetchBalance = async (pub: string) => {
        try {
            setBalance('…')
            const bal = await connRef.current.getBalance(new PublicKey(pub))
            setBalance((bal / LAMPORTS_PER_SOL).toFixed(6))
        } catch (err) {
            console.error(err)
            setBalance('error')
        }
    }

    /* ── Index change ── */
    const handleIndexChange = async (val: string) => {
        const i = Math.max(0, Math.floor(Number(val) || 0))
        setIndex(i)
        if (mnemonic && bip39.validateMnemonic(mnemonic)) {
            await deriveAccount(mnemonic, i)
        } else {
            setPubkey(null)
            setBalance(null)
        }
    }

    /* ── Send SOL ── */
    const sendSol = async () => {
        if (!keypairRef.current) { error('No derived keypair.'); return }
        if (!recipient) { error('Recipient required.'); return }
        let toPub: PublicKey
        try { toPub = new PublicKey(recipient) }
        catch { error('Invalid recipient public key.'); return }
        const amt = Number(amount)
        if (!(amt > 0)) { error('Amount must be > 0.'); return }

        try {
            loading('Creating transaction…')
            const conn = connRef.current
            const from = keypairRef.current
            const tx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: from.publicKey,
                    toPubkey: toPub,
                    lamports: Math.round(amt * LAMPORTS_PER_SOL),
                })
            )
            const sig = await conn.sendTransaction(tx, [from])
            loading(`Sent — confirming… ${sig.slice(0, 16)}…`)
            await conn.confirmTransaction(sig, 'confirmed')
            success(`Confirmed! ${sig}`)
            await fetchBalance(from.publicKey.toBase58())
        } catch (err: any) {
            console.error(err)
            error('Send failed: ' + (err.message ?? err))
        }
    }

    /* ── Clipboard ── */
    const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1000)
            info('Copied to clipboard.')
        } catch {
            error('Copy failed.')
        }
    }

    /* ── Components ── */
    const CopyButton = ({ text }: { text: string }) => {
        const [copied, setCopied] = useState(false)
        return (
            <button className="btn btn-ghost" onClick={() => copyToClipboard(text, setCopied)}>
                {copied ? 'Copied!' : 'Copy'}
            </button>
        )
    }

    /* ── Airdrop ── */
    const requestAirdrop = async () => {
        if (!pubkey) { error('No public key.'); return }
        try {
            loading('Requesting airdrop (1 SOL)…')
            // Always use the public devnet RPC for airdrops — third-party RPCs (Alchemy, etc.) don't support requestAirdrop
            const devnetConn = new Connection(clusterApiUrl('devnet'), 'confirmed')
            const sig = await devnetConn.requestAirdrop(new PublicKey(pubkey), LAMPORTS_PER_SOL)
            await devnetConn.confirmTransaction(sig, 'confirmed')
            success('Airdrop complete!')
            await fetchBalance(pubkey)
        } catch (err: any) {
            console.error(err)
            error('Airdrop failed: ' + (err.message ?? err))
        }
    }

    /* ── Auto-derive on mount ── */
    useEffect(() => {
        if (mnemonic && bip39.validateMnemonic(mnemonic)) {
            deriveAccount(mnemonic, index)
        }
    }, [])

    /* ── Mnemonic words ── */
    const words = mnemonic ? mnemonic.split(' ') : []

    /* ──────── RENDER ──────── */
    return (
        <div className="app">
            {/* Header */}
            <header className="app-header">
                <h1>Solana Wallet</h1>
                <p className="subtitle">Dev & testing only — do not use for mainnet funds</p>
                <div className="network-pill">
                    <select value={networkRpc} onChange={(e) => setNetworkRpc(e.target.value)}>
                        <option value={clusterApiUrl('devnet')}>Devnet</option>
                        <option value={clusterApiUrl('testnet')}>Testnet</option>
                        <option value={clusterApiUrl('mainnet-beta')}>Mainnet Beta</option>
                    </select>
                </div>
            </header>

            {/* Seed Section */}
            <section className="card">
                <h2 className="card-title">Seed Phrase</h2>

                <div className="word-count-toggle">
                    <button
                        className={`toggle-btn ${wordCount === 12 ? 'active' : ''}`}
                        onClick={() => setWordCount(12)}
                    >
                        12 words
                    </button>
                    <button
                        className={`toggle-btn ${wordCount === 24 ? 'active' : ''}`}
                        onClick={() => setWordCount(24)}
                    >
                        24 words
                    </button>
                </div>

                <div className="btn-row">
                    <button className="btn btn-primary" onClick={generateMnemonic}>Generate Mnemonic</button>
                    <button className="btn btn-outline" onClick={openImportModal}>Import Mnemonic</button>
                    {mnemonic && <CopyButton text={mnemonic} />}
                </div>

                {words.length > 0 ? (
                    <>
                        <div className={`mnemonic-grid ${showMnemonic ? '' : 'mnemonic-hidden'}`}>
                            {words.map((w, i) => (
                                <div className="mnemonic-pill" key={i}>
                                    <span className="pill-index">{i + 1}</span>
                                    <span className="pill-word">{w}</span>
                                </div>
                            ))}
                        </div>
                        <button className="mnemonic-toggle" onClick={() => setShowMnemonic(!showMnemonic)}>
                            {showMnemonic ? 'Hide words' : 'Show words'}
                        </button>
                    </>
                ) : (
                    <p className="mnemonic-placeholder">Generate or import a mnemonic to get started</p>
                )}

                <div className="security-warn">
                    <span>
                        <strong>Security:</strong> This demo exposes your mnemonic & private keys in the browser.
                        Do not use with mainnet funds.
                    </span>
                </div>
            </section>

            {/* Account Section */}
            <section className="card">
                <h2 className="card-title">Account</h2>
                <div className="derive-row">
                    <label>
                        Account index
                        <input
                            type="number"
                            min="0"
                            value={index}
                            onChange={(e) => handleIndexChange(e.target.value)}
                        />
                    </label>
                    <button
                        className="btn btn-outline"
                        onClick={() => deriveAccount(mnemonic, index)}
                        disabled={!mnemonic}
                    >
                        Derive
                    </button>
                </div>

                <div className="account-grid">
                    <div className="account-cell">
                        <div className="cell-label">Public Key</div>
                        <div className="cell-value">{pubkey ?? '—'}</div>
                        <div className="cell-actions">
                            {pubkey && <CopyButton text={pubkey} />}
                        </div>
                    </div>
                    <div className="account-cell">
                        <div className="cell-label">Balance (SOL)</div>
                        <div className="cell-value">{balance ?? '—'}</div>
                        <div className="cell-actions">
                            <button className="btn btn-ghost" onClick={() => pubkey && fetchBalance(pubkey)} disabled={!pubkey}>
                                Refresh
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={requestAirdrop}
                                disabled={!pubkey}
                            >
                                Airdrop 1 SOL
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Send Section */}
            <section className="card">
                <h2 className="card-title">Send SOL</h2>
                <div className="send-form">
                    <div className="form-group">
                        <label>Recipient Public Key</label>
                        <input
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            placeholder="Enter recipient address"
                        />
                    </div>
                    <div className="form-group">
                        <label>Amount (SOL)</label>
                        <input
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            type="number"
                            step="0.000001"
                            placeholder="0.01"
                        />
                    </div>
                    <div className="btn-row">
                        <button className="btn btn-primary" onClick={sendSol} disabled={!keypairRef.current}>
                            Send Transaction
                        </button>
                    </div>
                </div>
            </section>

            {/* Status */}
            {status && (
                <div className={statusClass(statusKind)}>
                    <span className="status-dot" />
                    {status}
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Import Mnemonic</h3>
                        <textarea
                            value={importText}
                            onChange={(e) => { setImportText(e.target.value); setImportError('') }}
                            placeholder="Paste your 12 or 24 word mnemonic here…"
                            autoFocus
                        />
                        {importError && <p className="modal-error">{importError}</p>}
                        <div className="btn-row">
                            <button className="btn btn-outline" onClick={() => setShowImportModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmImport}>Import</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="app-footer">
                Built with @solana/web3.js · bip39 · @noble/hashes — by YashGaikwad
            </footer>
        </div>
    )
}
