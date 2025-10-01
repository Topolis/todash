import fs from 'fs';
import path from 'path';

export const projectPlugin = {
  async fetchData(config) {
    const { getSecret } = await import('../secrets.js');
    // Basic info: version from package.json and uptime
    const rootPkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

    // Git info (best-effort)
    let git = null;
    const { execSync } = await import('node:child_process');
    function run(cmd) {
      try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
      catch { return null; }
    }
    try {
      const branch = run('git rev-parse --abbrev-ref HEAD');
      const commit = run('git rev-parse HEAD');
      const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
      let ahead = null, behind = null;
      if (upstream) {
        const counts = run('git rev-list --left-right --count @{u}...HEAD');
        if (counts) {
          const [left, right] = counts.split(/\s+/).map(n => Number(n));
          // left= behind, right= ahead for @{u}...HEAD
          behind = left; ahead = right;
        }
      }

      const status = run('git status --porcelain');
      let changed = 0, untracked = 0;
      if (status) {
        const lines = status.split(/\r?\n/).filter(Boolean);
        for (const ln of lines) {
          if (ln.startsWith('??')) untracked++;
          else changed++;
        }
      }
      const lastMsg = run('git log -1 --pretty=%s');
      const lastTime = run('git log -1 --pretty=%cI');
      const remoteUrl = run('git config --get remote.origin.url');

      git = { branch, commit, upstream, ahead, behind, changed, untracked, lastMsg, lastTime, remoteUrl };

      // GitHub (optional)
      let github = null;
      const token = getSecret('GITHUB_TOKEN') || getSecret('GH_TOKEN');
      if (remoteUrl && /github\.com/.test(remoteUrl)) {
        // parse owner/repo
        let owner = null, repo = null;
        if (remoteUrl.startsWith('git@')) {
          const m = remoteUrl.match(/github\.com:(.+?)\/(.+?)(\.git)?$/);
          if (m) { owner = m[1]; repo = m[2].replace(/\.git$/, ''); }
        } else {
          try {
            const u = new URL(remoteUrl.replace(/\.git$/, ''));
            const parts = u.pathname.replace(/^\//,'').split('/');
            owner = parts[0]; repo = parts[1];
          } catch {}
        }
        if (owner && repo) {
          const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'todash-dashboard' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          try {
            const branchName = git.branch || 'main';
            const pullsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${branchName}&per_page=1`, { headers });
            const pulls = pullsRes.ok ? await pullsRes.json() : [];
            const prCount = Array.isArray(pulls) ? pulls.length : 0;
            github = {
              owner, repo, branch: branchName,
              repoUrl: `https://github.com/${owner}/${repo}`,
              branchUrl: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branchName)}`,
              pullsOpen: prCount,
            };
          } catch {}
        }
      }
      if (github) git.github = github;
    } catch {}

    return {
      name: rootPkg.name,
      version: rootPkg.version || '0.0.0',
      serverTime: new Date().toISOString(),
      uptimeSec: process.uptime(),
      git,
    };
  },
};
