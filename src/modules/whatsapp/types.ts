// Configuración futura por proyecto. El token vive fuera de la base:
// project_whatsapp_settings.access_token_ref guarda la referencia al secreto.
export type WhatsAppProjectSettings = {
  projectId: string;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  accessTokenRef: string;
};

export type InboundWhatsAppMessage = {
  projectId: string;
  from: string;
  messageId: string;
  type: "text" | "audio" | "other";
  text: string | null;
  mediaId: string | null;
};
