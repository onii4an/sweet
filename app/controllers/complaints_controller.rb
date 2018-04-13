class ComplaintsController < ApplicationController
  def create
    Complaint.create(sender_id: params[:sender_id], bad_id: params[:bad_id])
  end

  def ban_reported
    @complaint = Complaint.find(params[:id])
    User.find(@complaint.bad_id).update_attribute :status, :banned
    @complaint.update_attribute :active, false
    AdminJob.perform_later('report', params[:id])
  end

  def ban_sender
    @complaint = Complaint.find(params[:id])
    User.find(@complaint.sender_id).update_attribute :status, :banned
    @complaint.update_attribute :active, false
  end

  def ignore
    Complaint.find(params[:id]).update_attribute :active, false
  end

  private

  def complaint_params
    params.permit(:sender_id, :bad_id)
  end
end
