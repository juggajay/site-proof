// Script to create test data for HP evidence package preview feature
const API_URL = 'http://localhost:4000';

async function main() {
  // Login as admin
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123' })
  });
  const { token, user } = await loginRes.json();
  console.log('Logged in as:', user.email);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Get a project
  const projectsRes = await fetch(`${API_URL}/api/projects`, { headers });
  const projects = await projectsRes.json();
  const project = projects[0];
  console.log('Using project:', project.name);

  // Create a lot for HP preview testing
  const lotRes = await fetch(`${API_URL}/api/lots`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: project.id,
      lotNumber: `HP-PREVIEW-TEST-${Date.now()}`,
      description: 'Test lot for HP evidence package preview',
      activityType: 'Earthworks',
      status: 'in_progress',
      chainageStart: '1000',
      chainageEnd: '1100'
    })
  });
  const lot = await lotRes.json();
  console.log('Created lot:', lot.lotNumber || lot.id);

  // Get ITP templates
  const templatesRes = await fetch(`${API_URL}/api/itp/templates?projectId=${project.id}`, { headers });
  const templates = await templatesRes.json();
  console.log('Available templates:', templates.length);

  // Find a template with hold points or create one
  let template = templates.find(t => t.checklistItems?.some(i => i.pointType === 'hold'));

  if (!template) {
    // Create a template with hold point
    const createTemplateRes = await fetch(`${API_URL}/api/itp/templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: project.id,
        name: 'HP Preview Test Template',
        activityType: 'Earthworks',
        description: 'Template for testing HP preview',
        checklistItems: [
          { sequenceNumber: 1, description: 'Site cleared and prepared', pointType: 'standard', responsibleParty: 'contractor' },
          { sequenceNumber: 2, description: 'Subgrade level check', pointType: 'standard', responsibleParty: 'contractor' },
          { sequenceNumber: 3, description: 'HOLD POINT: Subgrade compaction test', pointType: 'hold', responsibleParty: 'contractor' }
        ]
      })
    });
    template = await createTemplateRes.json();
    console.log('Created template:', template.name || template.id);
  } else {
    console.log('Using existing template:', template.name);
  }

  // Assign ITP to lot
  const assignRes = await fetch(`${API_URL}/api/itp/assign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      lotId: lot.id,
      templateId: template.id
    })
  });
  const assignResult = await assignRes.json();
  console.log('Assigned ITP to lot:', assignResult.message || 'success');

  // Get ITP instance
  const lotDetailRes = await fetch(`${API_URL}/api/lots/${lot.id}`, { headers });
  const lotDetail = await lotDetailRes.json();
  const itpInstance = lotDetail.itpInstance;

  if (!itpInstance) {
    console.error('No ITP instance found for lot');
    return;
  }

  // Parse the checklist items from template snapshot
  let checklistItems;
  try {
    const snapshot = JSON.parse(itpInstance.templateSnapshot);
    checklistItems = snapshot.checklistItems || [];
  } catch (e) {
    console.error('Failed to parse template snapshot');
    return;
  }

  console.log('Checklist items:', checklistItems.length);

  // Complete all items before the hold point
  for (const item of checklistItems) {
    if (item.pointType === 'hold') {
      console.log('Found hold point at sequence:', item.sequenceNumber);
      break;
    }

    // Complete this item
    const completeRes = await fetch(`${API_URL}/api/itp/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itpInstanceId: itpInstance.id,
        checklistItemId: item.id,
        status: 'completed',
        notes: `Completed for HP preview test - ${item.description}`
      })
    });
    const completion = await completeRes.json();
    console.log('Completed item:', item.sequenceNumber, item.description.substring(0, 30) + '...');
  }

  console.log('\n=== TEST DATA CREATED ===');
  console.log('Project ID:', project.id);
  console.log('Lot ID:', lot.id);
  console.log('Lot Number:', lot.lotNumber);
  console.log('ITP Instance ID:', itpInstance.id);
  console.log('\nAll prerequisites completed. You can now test the HP preview feature!');
}

main().catch(console.error);
