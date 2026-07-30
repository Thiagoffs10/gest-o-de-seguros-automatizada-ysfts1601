import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  policyNumber: string
  relatedCount: { payments: number; reminders: number }
  loading: boolean
}

export function DeletePolicyDialog({
  open,
  onOpenChange,
  onConfirm,
  policyNumber,
  relatedCount,
  loading,
}: Props) {
  const hasRelations = relatedCount.payments > 0 || relatedCount.reminders > 0
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Apólice</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a apólice <strong>{policyNumber}</strong>? Esta ação não
            pode ser desfeita.
            {hasRelations && (
              <span className="block mt-2 text-amber-600">
                Serão excluídos também: {relatedCount.payments} pagamento(s) e{' '}
                {relatedCount.reminders} lembrete(s) vinculados.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
