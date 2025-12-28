export type FieldDefinition = {
    key: string;
    label: string;
    type: string; // TEXT / NUMBER / SECRET / DATE / URL / TEXTAREA
    required: boolean;
    sensitive: boolean;
};

export type Template = {
    id: string;
    name: string;
    brand?: string | null;
    fields: FieldDefinition[];
    createdAt: string;
    updatedAt: string;
};

export type Card = {
    id: string;
    templateId: string;
    displayName?: string | null;
    data: Record<string, string>;
    createdAt?: string;
};
