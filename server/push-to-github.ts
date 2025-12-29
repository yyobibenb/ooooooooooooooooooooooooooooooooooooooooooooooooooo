import { getGitHubClient, getGitHubUser } from './github';
import * as fs from 'fs';
import * as path from 'path';

const REPO_OWNER = 'yyobibenb';
const REPO_NAME = 'ooooooooooooooooooooooooooooooooooooooooooooooooooo';
const BRANCH = 'main';

async function getAllFiles(dir: string, baseDir: string = dir): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.name === 'node_modules' || 
        entry.name === '.git' || 
        entry.name === '.cache' ||
        entry.name === '.local' ||
        entry.name === '.upm' ||
        entry.name === 'workspace' ||
        entry.name === 'attached_assets' ||
        entry.name === '.replit' ||
        entry.name === 'replit.nix' ||
        entry.name === '.env' ||
        entry.name === '.env.local') {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir));
    } else {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.json', '.css', '.html', '.md', '.svg'].includes(ext) || entry.name === '.replit') {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({ path: relativePath, content });
        } catch (e) {
          console.error(`Failed to read ${fullPath}:`, e);
        }
      }
    }
  }

  return files;
}

async function pushToGitHub() {
  console.log('Getting GitHub client...');
  const client = await getGitHubClient();
  
  console.log('Getting user info...');
  const user = await getGitHubUser();
  console.log(`Authenticated as: ${user.login}`);

  console.log('Collecting files...');
  const projectDir = '/home/runner/workspace';
  const files = await getAllFiles(projectDir);
  console.log(`Found ${files.length} files to push`);

  console.log('Creating blobs...');
  const blobs = await Promise.all(
    files.map(async (file) => {
      const { data } = await client.git.createBlob({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64'
      });
      console.log(`  Created blob for ${file.path}`);
      return { path: file.path, sha: data.sha };
    })
  );

  console.log('Getting current branch ref...');
  let parentSha: string | undefined;
  try {
    const { data: ref } = await client.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`
    });
    parentSha = ref.object.sha;
    console.log(`Current branch SHA: ${parentSha}`);
  } catch (e) {
    console.log('Branch does not exist, will create new');
  }

  console.log('Creating tree...');
  const { data: tree } = await client.git.createTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    tree: blobs.map(blob => ({
      path: blob.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blob.sha
    }))
  });
  console.log(`Created tree: ${tree.sha}`);

  console.log('Creating commit...');
  const { data: commit } = await client.git.createCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    message: 'Update: AI IDE with enhanced status display and GitHub integration',
    tree: tree.sha,
    parents: parentSha ? [parentSha] : []
  });
  console.log(`Created commit: ${commit.sha}`);

  console.log('Updating branch ref...');
  if (parentSha) {
    await client.git.updateRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
      sha: commit.sha,
      force: true
    });
  } else {
    await client.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${BRANCH}`,
      sha: commit.sha
    });
  }

  console.log(`\n✅ Successfully pushed to https://github.com/${REPO_OWNER}/${REPO_NAME}`);
}

pushToGitHub().catch(console.error);
