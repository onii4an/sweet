class MainAdminController < ApplicationController
  before_action :check_admin
  helper_method :complaint
  helper_method :find_cv

  def index; end

  def reports; end

  def cv_search; end

  def complaint
    Complaint.where active: true
  end

  def find_cv
    if !params[:boy_id].empty? && !params[:girl_id].empty?
      Conversation.where boy_id: params[:boy_id], girl_id: params[:girl_id]
    elsif !params[:boy_id].empty?
      Conversation.where(boy_id: params[:boy_id])
    elsif !params[:girl_id].empty?
      Conversation.where(girl_id: params[:girl_id])
    end
  end

  private

  def check_admin
    redirect_to root_path unless current_admin
  end
end
