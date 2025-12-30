import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

export async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export async function getGitHubUser() {
  const client = await getGitHubClient();
  const { data } = await client.users.getAuthenticated();
  return data;
}

export async function listRepos() {
  const client = await getGitHubClient();
  const { data } = await client.repos.listForAuthenticatedUser({ per_page: 100 });
  return data;
}

export async function pushToRepo(owner: string, repo: string, branch: string, files: { path: string; content: string }[], message: string) {
  const client = await getGitHubClient();
  
  let sha: string | undefined;
  try {
    const { data: ref } = await client.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    sha = ref.object.sha;
  } catch (e) {
    console.log('Branch does not exist, will create');
  }

  const blobs = await Promise.all(
    files.map(async (file) => {
      const { data } = await client.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64'
      });
      return { path: file.path, sha: data.sha };
    })
  );

  const { data: baseTree } = sha 
    ? await client.git.getTree({ owner, repo, tree_sha: sha })
    : { data: { sha: undefined } };

  const { data: tree } = await client.git.createTree({
    owner,
    repo,
    base_tree: baseTree.sha,
    tree: blobs.map(blob => ({
      path: blob.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blob.sha
    }))
  });

  const { data: commit } = await client.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.sha,
    parents: sha ? [sha] : []
  });

  if (sha) {
    await client.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.sha
    });
  } else {
    await client.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: commit.sha
    });
  }

  return commit;
}
