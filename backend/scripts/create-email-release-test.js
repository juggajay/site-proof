// Script to create test data for HP email release feature
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

  // Get projects
  const projectsRes = await fetch(`${API_URL}/api/projects`, { headers });
  const projectsData = await projectsRes.json();
  console.log('Projects response:', JSON.stringify(projectsData).substring(0, 200));

  // Handle both array and object response
  const projects = Array.isArray(projectsData) ? projectsData : (projectsData.projects || []);

  if (!projects || projects.length === 0) {
    console.log('No projects found, creating one...');
    const createProjectRes = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Email Release Test Project',
        projectNumber: 'ERT-001',
        description: 'Project for testing email HP release'
      })
    });
    const newProject = await createProjectRes.json();
    console.log('Created project:', newProject.name || newProject.id);
    projects.push(newProject);
  }

  const project = projects[0];
  console.log('Using project:', project.name, project.id);

  // Create a lot for email release testing
  const lotRes = await fetch(`${API_URL}/api/lots`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: project.id,
      lotNumber: `EMAIL-RELEASE-TEST-${Date.now()}`,
      description: 'Test lot for HP email release',
      activityType: 'Earthworks',
      status: 'in_progress',
      chainageStart: '2000',
      chainageEnd: '2100'
    })
  });
  const lot = await lotRes.json();
  console.log('Created lot:', lot.lotNumber || lot.id);

  // Get or create ITP template with hold point
  const templatesRes = await fetch(`${API_URL}/api/itp/templates?projectId=${project.id}`, { headers });
  const templatesData = await templatesRes.json();
  const templates = Array.isArray(templatesData) ? templatesData : (templatesData.templates || []);
  console.log('Found templates:', templates.length);

  let template = templates.find(t => t.checklistItems?.some(i => i.pointType === 'hold_point'));

  if (!template) {
    const createTemplateRes = await fetch(`${API_URL}/api/itp/templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: project.id,
        name: 'Email Release Test Template',
        activityType: 'Earthworks',
        description: 'Template for testing email HP release',
        checklistItems: [
          { sequenceNumber: 1, description: 'Site preparation complete', pointType: 'standard', responsibleParty: 'contractor' },
          { sequenceNumber: 2, description: 'HOLD POINT: Email approval required', pointType: 'hold_point', responsibleParty: 'contractor' }
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
  console.log('Assigned ITP:', assignResult.message || 'success');

  // Get lot details to complete prerequisites
  const lotDetailRes = await fetch(`${API_URL}/api/lots/${lot.id}`, { headers });
  const lotDetail = await lotDetailRes.json();
  const itpInstance = lotDetail.itpInstance;

  if (!itpInstance) {
    console.error('No ITP instance found');
    return;
  }

  // Complete the first item (prerequisite)
  const firstItem = itpInstance.template?.checklistItems?.find(i => i.sequenceNumber === 1);
  if (firstItem) {
    await fetch(`${API_URL}/api/itp/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itpInstanceId: itpInstance.id,
        checklistItemId: firstItem.id,
        status: 'completed',
        notes: 'Completed for email release test'
      })
    });
    console.log('Completed prerequisite item');
  }

  // Now request release for the hold point
  const holdPointItem = itpInstance.template?.checklistItems?.find(i => i.pointType === 'hold_point');
  if (holdPointItem) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);

    const requestRes = await fetch(`${API_URL}/api/holdpoints/request-release`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lotId: lot.id,
        itpChecklistItemId: holdPointItem.id,
        scheduledDate: tomorrow.toISOString().split('T')[0],
        scheduledTime: '10:00',
        notificationSentTo: 'inspector@test.com'
      })
    });
    const requestResult = await requestRes.json();
    console.log('Requested release:', requestResult.message || requestResult.error || 'done');
  }

  console.log('\n=== TEST DATA CREATED ===');
  console.log('Project ID:', project.id);
  console.log('Lot ID:', lot.id);
  console.log('\nYou can now test the email HP release feature!');
}

main().catch(console.error);
