import React, { useEffect, useState } from 'react';

// A minimal template to start a new widget
export default function TemplateWidget(props) {
  // optional: uncomment if your widget needs server data
  // const [data, setData] = useState(null);
  // useEffect(() => {
  //   fetch('/api/widget/your-type', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(props)
  //   }).then(r => r.json()).then(({ data }) => setData(data));
  // }, [props]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <span>Your widget content here</span>
    </div>
  );
}

