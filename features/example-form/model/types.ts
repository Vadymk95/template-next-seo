// Example form feature types

export interface ExampleFormData {
    name: string;
    email: string;
}

export interface ExampleFormResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: ExampleFormData;
    errors?: Array<{ path: string[]; message: string }>;
}
