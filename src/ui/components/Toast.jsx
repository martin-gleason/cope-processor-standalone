export function Toast({ message }) {
  if (!message) return null;
  return (
    <div class="ocs-toast" role="status">
      {message}
    </div>
  );
}
