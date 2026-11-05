// Page the responsible party opens from the QR code to sign the Incident Acknowledgment and Undertaking.
import { useState } from 'react'
import { useParams } from 'react-router'
import { repo } from '../../data/repo'
import { fmtDate, peso } from '../../domain/dates'
import { useData } from '../../state'
import { CheckDraw } from '../../ui/CheckDraw'
import { SignaturePad } from '../../ui/SignaturePad'
import { SlideToConfirm } from '../../ui/SlideToConfirm'
import { nowManila } from '../field/proof'
import { bomTotals } from './Incidents'

export function Ack() {
  const { id } = useParams()
  const { snap, setSnap } = useData()
  const inc = snap.incidents.find(i => i.id === id)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [signature, setSignature] = useState<string>()
  const [done, setDone] = useState(false)
  if (!inc) return <p className="p-8 text-muted">This incident link is not valid.</p>
  const total = bomTotals(inc.bom).total
  const field = 'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]'

  if (done || inc.undertaking) return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center px-5 py-16 text-center" role="status">
      <CheckDraw />
      <h1 className="mt-4 text-xl font-semibold">Acknowledgment received</h1>
      <p className="mt-1 text-sm text-muted">Thank you. A copy is kept with incident {inc.id}.</p>
    </main>
  )

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <p className="text-xs text-muted">Converge-J Fiber · Incident {inc.id}</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">Incident Acknowledgment and Undertaking</h1>
      <dl className="mt-5 space-y-1.5 rounded-2xl border border-border bg-surface p-4 text-[13px]">
        <div><dt className="inline text-muted">Responsible party: </dt><dd className="inline font-medium">{inc.responsibleParty}</dd></div>
        <div><dt className="inline text-muted">When: </dt><dd className="inline">{fmtDate(inc.receivedAt.slice(0, 10))} {inc.receivedAt.slice(11, 16)}</dd></div>
        <div><dt className="inline text-muted">Where: </dt><dd className="inline">{inc.faultLocation} ({inc.affectedLink})</dd></div>
        <div><dt className="inline text-muted">What: </dt><dd className="inline">{inc.description}</dd></div>
        {total > 0 && <div><dt className="inline text-muted">Restoration cost so far: </dt><dd className="inline font-medium">{peso(total)}</dd></div>}
      </dl>
      <p className="mt-5 text-[14px] leading-relaxed">
        I acknowledge that the party named above caused damage to the fiber optic facilities described, and undertake to shoulder the cost of
        temporary and permanent restoration as itemized in the bill of materials.
      </p>
      <p className="mt-1 text-xs text-muted">Placeholder wording for the prototype. Final text to come from Converge-J Fiber legal.</p>
      <div className="mt-5 space-y-3">
        <input aria-label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={field} />
        <input aria-label="Position / company" value={position} onChange={e => setPosition(e.target.value)} placeholder="Position and company" className={field} />
        <SignaturePad label="Your signature" value={signature} onChange={setSignature} />
        <SlideToConfirm label="Slide to sign" disabled={!name.trim() || !signature} onConfirm={async () => {
          setSnap(await repo.saveIncident({ ...inc, undertakingSigned: true, undertaking: { name: name.trim(), position: position.trim(), signature: signature!, at: nowManila(), via: 'qr-link' } }))
          setDone(true)
        }} />
      </div>
    </main>
  )
}
