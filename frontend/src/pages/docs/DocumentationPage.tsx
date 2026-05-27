import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, CircleDot, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { documentationSections, quickReference, workflowSteps } from './documentationContent';

export function DocumentationPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            SiteProof documentation
          </div>
          <h1 className="text-3xl font-bold tracking-tight">User guide and workflow reference</h1>
          <p className="mt-2 text-muted-foreground">
            Use this guide when setting up a project, collecting evidence, managing subcontractors,
            approving dockets, creating claims, and preparing handover records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/support">Contact Support</Link>
          </Button>
          <Button asChild>
            <Link to="/projects">
              Open Projects
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold leading-none tracking-tight">Start here</h2>
          <CardDescription>
            SiteProof works best when the project is treated as one evidence pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 md:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <li key={step.title} className="rounded-lg border bg-background p-4">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <h2 className="font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
                <Search className="h-4 w-4" />
                Browse topics
              </h2>
            </CardHeader>
            <CardContent className="space-y-1">
              {documentationSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <section.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{section.title}</span>
                </a>
              ))}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4">
          {documentationSections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-6">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold leading-none tracking-tight">{section.title}</h2>
                    <CardDescription className="mt-1">{section.summary}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {section.steps.map((step) => (
                    <div key={step.title} className="rounded-lg border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <CircleDot className="h-4 w-4 text-primary" />
                        {step.title}
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <h3 className="text-sm font-semibold">Field notes</h3>
                  <ul className="mt-3 grid gap-2 md:grid-cols-3">
                    {section.tips.map((tip) => (
                      <li key={tip} className="flex gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {section.route && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={section.route}>
                      Open {section.title}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold leading-none tracking-tight">Quick reference</h2>
          <CardDescription>
            Jump to the main surfaces you will use during daily project control.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quickReference.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm font-medium hover:bg-muted"
              >
                <item.icon className="h-4 w-4 text-primary" />
                {item.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
