export type PostEncryptionData = {
	encrypted?: boolean;
	password?: string | number;
	requiresPassword?: boolean;
	permissionType?: string;
};

/**
 * Resolves whether a post is encrypted / password protected.
 * Returns true if the post is marked as encrypted, requires a password,
 * has a password permission type, or has a password string configured.
 * Never throws on valid encrypted post objects even if password is omitted
 * by the public API for security.
 */
export function isEncryptedPost(data?: PostEncryptionData | null): boolean {
	if (!data) return false;
	const hasPassword =
		data.password !== undefined && String(data.password).trim().length > 0;
	return Boolean(
		data.encrypted ||
		data.requiresPassword ||
		data.permissionType === "password" ||
		hasPassword
	);
}
