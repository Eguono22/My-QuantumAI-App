function normalizeBaseUrl(raw) {
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function buildTargetUrl(baseUrl, pathParts, query) {
  const path = Array.isArray(pathParts) ? pathParts.join('/') : '';
  const url = new URL(`${baseUrl}/${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}

module.exports = async function handler(req, res) {
  const backendBaseUrl = normalizeBaseUrl(process.env.BACKEND_API_BASE_URL);

  if (!backendBaseUrl) {
    res.status(500).json({
      detail: 'Server misconfigured: BACKEND_API_BASE_URL is not set.',
    });
    return;
  }

  const targetUrl = buildTargetUrl(backendBaseUrl, req.query.path, req.query);
  const method = req.method || 'GET';

  const headers = {
    Accept: req.headers.accept || 'application/json',
    'Content-Type': req.headers['content-type'] || 'application/json',
  };

  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  const init = { method, headers };
  if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  }

  try {
    const response = await fetch(targetUrl, init);
    const contentType = response.headers.get('content-type') || 'application/json';
    const text = await response.text();

    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    res.send(text);
  } catch (error) {
    res.status(502).json({
      detail: 'Unable to reach backend API from Vercel function.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
