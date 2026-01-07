import fs from 'fs';

const deleteEndpoint = `

// DELETE /api/projects/:id - Delete a project (requires password confirmation)
projectsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { password } = req.body
    const user = req.user!

    // Password is required for deletion
    if (!password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password confirmation is required to delete a project'
      })
    }

    // Get the full user record with password hash
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true,
        roleInCompany: true,
        companyId: true,
      },
    })

    if (!fullUser || !fullUser.passwordHash) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      })
    }

    // Verify password
    const { verifyPassword } = await import('../lib/auth.js')
    if (!verifyPassword(password, fullUser.passwordHash)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Incorrect password'
      })
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        companyId: true,
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Authorization: Only owner/admin can delete, or project must be in user's company
    const isAdmin = fullUser.roleInCompany === 'admin' || fullUser.roleInCompany === 'owner'
    const isCompanyProject = project.companyId === fullUser.companyId

    if (!isAdmin && !isCompanyProject) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this project'
      })
    }

    // Delete the project (cascading deletes will handle related records)
    await prisma.project.delete({
      where: { id },
    })

    res.json({
      message: 'Project deleted successfully',
      deletedProject: { id: project.id, name: project.name }
    })
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
`;

const filePath = 'D:/site-proofv3/backend/src/routes/projects.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Check if delete endpoint already exists
if (content.includes("projectsRouter.delete('/:id'")) {
  console.log('Delete endpoint already exists');
  process.exit(0);
}

fs.writeFileSync(filePath, content + deleteEndpoint);
console.log('Delete endpoint added successfully');
