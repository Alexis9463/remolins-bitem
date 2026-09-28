import { IconX } from './Icons';

export default function Modal({ title, onClose, children, footer }) {
  return (
    <div
      className="fixed inset-0 bg-[rgba(15,25,17,0.5)] backdrop-blur-[2px] flex items-center justify-center z-[100] p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center px-5 py-4 border-b border-line sticky top-0 bg-white z-10">
          <div className="font-display font-bold text-lg uppercase">{title}</div>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">{footer}</div>}
      </div>
    </div>
  );
}
