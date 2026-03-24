export default function WidgetCard({ title, subtitle, children, footer }) {
  return (
    <div className="rounded border border-blue-900/30 bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-blue-950">{title}</div>
        {subtitle ? <div className="text-xs text-blue-900/60">{subtitle}</div> : null}
      </div>
      <div>{children}</div>
      {footer ? <div className="mt-3 border-t border-blue-900/20 pt-3 text-xs text-blue-900/60">{footer}</div> : null}
    </div>
  )
}
