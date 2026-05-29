'use client';

import { Modal, ModalCloseButton } from '@/components/ui/modal';

/**
 * Styled confirmation modal replacing window.confirm() for destructive
 * actions (kill-switch, emergency close, etc.).
 */
export function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} label={title}>
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">{title}</p>
        <ModalCloseButton onClose={onCancel} />
      </header>
      <p className="mt-3 text-sm text-ink-soft">{description}</p>
      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-divider px-4 py-2.5 text-sm font-medium text-ink hover:border-ink/30"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={
            'rounded-md px-4 py-2.5 text-sm font-medium text-parchment ' +
            (destructive
              ? 'bg-neg hover:bg-neg/90'
              : 'bg-ink hover:bg-ink-dark')
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
