import { ArrowRight } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';

export function ServiceCard({ icon: Icon, title, description, onClick }) {
  return (
    <Card hover onClick={onClick}>
      <CardBody className="flex flex-col h-full">
        <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
          <Icon className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-xl text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4 flex-grow">{description}</p>
        <div className="flex items-center text-primary group">
          <span className="transition-transform duration-300 group-hover:translate-x-1">Get started</span>
          <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </CardBody>
    </Card>
  );
}
