import { TaskPriority } from './task.model';
export type IncidentStatus =
  | 'REGISTERED'
  | 'DEVELOPMENT'
  | 'CERT'
  | 'QA_APPROVED'
  | 'UAT'
  | 'CLIENT_APPROVED'
  | 'CLOSED'
  | 'CANCELLED';
export type IncidentEnvironment = 'DESA' | 'CERT' | 'UAT' | 'PROD';
export interface IncidentRequest {
  title: string;
  description: string;
  detectedEnvironment: IncidentEnvironment;
  priority: TaskPriority;
  reporter: string;
  projectId: number | null;
  taskId: number | null;
  developerId: number | null;
  qaId: number | null;
  reproductionSteps: string;
  expectedResult: string;
  actualResult: string;
  dueDate: string | null;
}
export interface IncidentEvent {
  id: number;
  type: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  actor: string;
  observation: string;
  evidenceUrl?: string;
  createdAt: string;
}
export interface IncidentAttachment {
  id: number;
  category: 'INCIDENT' | 'CORRECTION';
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
}
export interface Incident extends IncidentRequest {
  id: number;
  status: IncidentStatus;
  projectName: string;
  taskTitle?: string;
  developerName?: string;
  qaName?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  events: IncidentEvent[];
  attachments: IncidentAttachment[];
}
export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  REGISTERED: 'Registrado',
  DEVELOPMENT: 'En desarrollo · DESA',
  CERT: 'En certificación · CERT',
  QA_APPROVED: 'Certificado por QA',
  UAT: 'Validación del cliente · UAT',
  CLIENT_APPROVED: 'Aprobado · pendiente PROD',
  CLOSED: 'Desplegado · cerrado',
  CANCELLED: 'Cancelado',
};
export const INCIDENT_ACTIONS: Record<string, string> = {
  START: 'Iniciar desarrollo',
  SEND_CERT: 'Enviar a CERT',
  APPROVE_QA: 'Certificar QA',
  SEND_UAT: 'Enviar a UAT',
  APPROVE_CLIENT: 'Aprobar cliente',
  DEPLOY: 'Registrar despliegue PROD y cerrar',
  REJECT: 'Rechazar y devolver a desarrollo',
  REOPEN: 'Reabrir',
  CANCEL: 'Cancelar incidente',
};
