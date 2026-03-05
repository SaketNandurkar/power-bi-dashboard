import React from 'react';
import { CheckCircleIcon } from './Icons';

export default function Stepper({ steps, currentStep }) {
  return (
    <div className="stepper">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div
            key={step}
            className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
          >
            <div className="stepper-content">
              <div className="stepper-circle">
                {isCompleted ? (
                  <CheckCircleIcon size={16} />
                ) : (
                  stepNumber
                )}
              </div>
              <span className="stepper-label">{step}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
