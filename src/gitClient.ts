import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

const execFileAsync = promisify(execFile);

export class GitClient {
    constructor(private readonly workspaceRoot: string) {}

    private async git(args: string[]): Promise<string> {
        const { stdout } = await execFileAsync('git', args, { cwd: this.workspaceRoot });
        return stdout;
    }

    async branchExists(branch: string): Promise<boolean> {
        try {
            await this.git(['rev-parse', '--verify', `refs/heads/${branch}`]);
            return true;
        } catch {
            return false;
        }
    }

    async currentBranch(): Promise<string> {
        const out = await this.git(['rev-parse', '--abbrev-ref', 'HEAD']);
        return out.trim();
    }

    /**
     * Creates an orphan branch with no commits and no files in the index.
     * Does NOT switch the working tree permanently — switches back to original branch.
     */
    async createOrphanBranch(branch: string): Promise<void> {
        const original = await this.currentBranch();

        // Create orphan, clean index
        await this.git(['checkout', '--orphan', branch]);
        await this.git(['rm', '-rf', '--quiet', '.']);

        // Create an empty initial commit so the branch ref exists
        await execFileAsync('git', [
            'commit', '--allow-empty', '-m', `chore: init ${branch} orphan branch`
        ], { cwd: this.workspaceRoot });

        // Switch back
        await this.git(['checkout', original]);
    }

    /**
     * Reads a file from a branch without touching the working tree.
     * Uses `git show branch:path`.
     */
    async readFile(branch: string, filePath: string): Promise<string> {
        // Normalise to forward slashes for git
        const gitPath = filePath.replace(/\\/g, '/');
        const out = await this.git(['show', `${branch}:${gitPath}`]);
        return out;
    }

    /**
     * Writes a file to a branch without touching the working tree.
     * Pipeline: write content to temp file → git hash-object → git update-index
     * → git write-tree → git commit-tree → git update-ref
     */
    async writeFile(branch: string, filePath: string, content: string): Promise<void> {
        // Write content to a temp file
        const tmpPath = path.join(os.tmpdir(), `cfm-${Date.now()}.tmp`);
        await fs.writeFile(tmpPath, content, 'utf8');

        try {
            // Hash the blob
            const { stdout: hashOut } = await execFileAsync('git', [
                'hash-object', '-w', tmpPath
            ], { cwd: this.workspaceRoot });
            const blobHash = hashOut.trim();

            // Get current tree of the branch
            const { stdout: treeOut } = await execFileAsync('git', [
                'rev-parse', `${branch}^{tree}`
            ], { cwd: this.workspaceRoot });
            const currentTreeHash = treeOut.trim();

            // Read the current index for that branch's tree
            // We use a separate index file to avoid touching the working index
            const tmpIndex = path.join(os.tmpdir(), `cfm-index-${Date.now()}.tmp`);
            await execFileAsync('git', [
                'read-tree', currentTreeHash
            ], { cwd: this.workspaceRoot, env: { ...process.env, GIT_INDEX_FILE: tmpIndex } });

            // Update the index with our new blob
            const gitPath = filePath.replace(/\\/g, '/');
            await execFileAsync('git', [
                'update-index', '--add', '--cacheinfo', `100644,${blobHash},${gitPath}`
            ], { cwd: this.workspaceRoot, env: { ...process.env, GIT_INDEX_FILE: tmpIndex } });

            // Write the new tree
            const { stdout: newTreeOut } = await execFileAsync('git', [
                'write-tree'
            ], { cwd: this.workspaceRoot, env: { ...process.env, GIT_INDEX_FILE: tmpIndex } });
            const newTreeHash = newTreeOut.trim();

            // Get parent commit
            const { stdout: parentOut } = await execFileAsync('git', [
                'rev-parse', branch
            ], { cwd: this.workspaceRoot });
            const parentHash = parentOut.trim();

            // Create commit
            const { stdout: commitOut } = await execFileAsync('git', [
                'commit-tree', newTreeHash, '-p', parentHash, '-m', `feat: update ${gitPath}`
            ], { cwd: this.workspaceRoot });
            const commitHash = commitOut.trim();

            // Update the branch ref
            await execFileAsync('git', [
                'update-ref', `refs/heads/${branch}`, commitHash
            ], { cwd: this.workspaceRoot });

            // Clean up temp index
            await fs.unlink(tmpIndex).catch(() => undefined);
        } finally {
            await fs.unlink(tmpPath).catch(() => undefined);
        }
    }
}
