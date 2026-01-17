// User entity types

export interface User {
    id: string;
    username: string;
    email?: string;
}

export interface UserState {
    isLoggedIn: boolean;
    username: string | null;
}
