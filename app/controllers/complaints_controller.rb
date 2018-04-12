class ComplaintsController < ApplicationController
  def create
    Complaint.create(complaint_params)
  end

  private

  def complaint_params
    params.permit(:sender_id, :bad_id)
  end
end
