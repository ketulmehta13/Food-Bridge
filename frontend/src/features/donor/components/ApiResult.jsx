// Shows the state of an API call: loading, the error message (with status and
// field errors) and the raw JSON response. Used by every donor test page.
export default function ApiResult({ loading, error, data, title = 'Response' }) {
  if (!loading && !error && data === undefined) return null;

  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm">
      <h3 className="mb-2 font-semibold text-gray-700">{title}</h3>
      {loading && <p className="text-gray-500">Loading...</p>}

      {error && (
        <div className="text-red-700">
          <p className="font-medium">
            {error.status ? `${error.status}: ` : ''}
            {error.message}
          </p>
          {error.body?.errors?.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {error.body.errors.map((e, i) => (
                <li key={i}>
                  <code>{e.field || '(body)'}</code>: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(error?.body ?? data) !== undefined && (
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-50 p-2 text-xs">
          {JSON.stringify(error?.body ?? data, null, 2)}
        </pre>
      )}
    </section>
  );
}
