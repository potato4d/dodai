import * as React from 'react'

const script = `async function subscribe() {
  fetch('http://localhost:10020')
  .then(() => {
    location.reload();
  })
  .catch((e) => {
    setTimeout(() => {
      subscribe();
    }, 1000);
  })
}
subscribe();`;


export const HotReload: React.FC<{ dev?: boolean }> = ({ dev }) => {
  if (dev === false) {
    return null;
  }

  if (dev === true || (dev === undefined) && process.env.NODE_ENV !== 'production') {
    return (
      <script dangerouslySetInnerHTML={{
        __html: script
      }} />
    )
  }

  return null;
}
